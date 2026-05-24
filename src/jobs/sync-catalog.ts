import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardPrices,
  cardmarketProducts,
  cards,
  cardVariants,
  sets,
  syncJobs,
} from "@/db/schema";
import { rebuildCardSearchVectors } from "@/lib/catalog-search";
import {
  mergeLocalized,
  getLocalizedString,
  type LocalizedStrings,
} from "@/lib/catalog-languages";
import { normalizeRarity } from "@/lib/rarity";
import {
  buildImageUrl,
  CATALOG_FALLBACK_LANG,
  decodeTcgdexLocalId,
  delay,
  deriveVariantTypes,
  fetchCardWithFallback,
  fetchCatalogSets,
  fetchSetAllLangs,
  buildMultilangNameHints,
  mergeSetLocalizedFields,
  pricingForVariant,
  type TcgdexSetDetail,
  type TcgdexSetSummary,
} from "@/lib/tcgdex";
import { existsSync } from "node:fs";
import type { SetImageKind } from "@/lib/image-paths";
import {
  cacheCardImage,
  cacheSetImage,
  getSetImageAbsolutePath,
  removeSetPlaceholderImage,
  resolveSetPlaceholderLabel,
  writeSetPlaceholderImage,
} from "@/lib/image-storage";
import { findActiveSetCardsJob } from "@/jobs/sync-job-utils";
import { enqueueSetCardsSync } from "@/jobs/boss";
import { encodeSyncJobMessage } from "@/lib/sync-job-messages";
import type {
  CatalogCardError,
  SyncJobFailure,
} from "@/lib/sync-job-display";

const BATCH_DELAY_MS = 120;

function getCatalogSetIdsFilter(): string[] | null {
  const raw = process.env.CATALOG_SET_IDS?.trim();
  if (!raw) return null;

  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : null;
}

function getCatalogSetCardLimit(): number | null {
  const raw = process.env.CATALOG_SET_CARD_LIMIT?.trim();
  if (!raw) return null;

  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    console.warn(
      `[catalog] Ignoring invalid CATALOG_SET_CARD_LIMIT: ${raw}`,
    );
    return null;
  }

  return limit;
}

function applyCatalogSetFilter(
  catalogSets: TcgdexSetSummary[],
  filterIds: string[],
): TcgdexSetSummary[] {
  const setsById = new Map(catalogSets.map((set) => [set.id, set]));

  return filterIds.flatMap((id) => {
    const set = setsById.get(id);
    if (!set) {
      console.warn(`[catalog] Unknown set id in CATALOG_SET_IDS: ${id}`);
      return [];
    }
    return [set];
  });
}

async function lookupCardmarketName(
  productId: number | null | undefined,
): Promise<string | null> {
  if (!productId) return null;

  const product = await db.query.cardmarketProducts.findFirst({
    where: eq(cardmarketProducts.idProduct, productId),
    columns: { name: true },
  });

  return product?.name ?? null;
}

async function syncSetImageKind(
  setId: string,
  kind: SetImageKind,
  sourceUrl: string | null | undefined,
  placeholderLabel: string,
) {
  if (sourceUrl) {
    await cacheSetImage(setId, kind, sourceUrl);
    if (!existsSync(getSetImageAbsolutePath(setId, kind))) {
      await removeSetPlaceholderImage(setId, kind);
    }
    return;
  }

  await writeSetPlaceholderImage(setId, kind, placeholderLabel);
}

async function syncSetImages(detail: TcgdexSetDetail, enDetail: TcgdexSetDetail) {
  const logoUrl = detail.logo ?? enDetail.logo ?? null;
  const symbolUrl = detail.symbol ?? enDetail.symbol ?? null;
  const placeholderBase = {
    officialCode: detail.abbreviation?.official,
    name: detail.name,
  };

  await syncSetImageKind(
    detail.id,
    "logo",
    logoUrl,
    resolveSetPlaceholderLabel(
      placeholderBase.officialCode,
      placeholderBase.name,
      "logo",
    ),
  );
  await syncSetImageKind(
    detail.id,
    "symbol",
    symbolUrl,
    resolveSetPlaceholderLabel(
      placeholderBase.officialCode,
      placeholderBase.name,
      "symbol",
    ),
  );
}

async function upsertSetMetadata(summary: TcgdexSetSummary) {
  const details = await fetchSetAllLangs(summary.id);
  const { names, seriesNames, seriesId, detail } = mergeSetLocalizedFields(
    details,
    summary,
  );
  const enDetail =
    details.get(CATALOG_FALLBACK_LANG) ?? detail;
  const deDetail = details.get("de") ?? enDetail;

  await syncSetImages(deDetail, enDetail);

  const existing = await db.query.sets.findFirst({
    where: eq(sets.id, detail.id),
    columns: { names: true, seriesNames: true },
  });

  const mergedNames = mergeLocalized(existing?.names ?? {}, names);
  const mergedSeriesNames = mergeLocalized(
    existing?.seriesNames ?? {},
    seriesNames,
  );

  await db
    .insert(sets)
    .values({
      id: detail.id,
      names: mergedNames,
      seriesId,
      seriesNames: mergedSeriesNames,
      releaseDate: detail.releaseDate ?? null,
      logoUrl: detail.logo ?? null,
      symbolUrl: detail.symbol ?? null,
      officialCode: detail.abbreviation?.official ?? null,
      cardCountTotal: detail.cardCount?.total ?? 0,
      cardCountOfficial: detail.cardCount?.official ?? 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sets.id,
      set: {
        names: mergedNames,
        seriesId,
        seriesNames: mergedSeriesNames,
        releaseDate: detail.releaseDate ?? null,
        logoUrl: detail.logo ?? null,
        symbolUrl: detail.symbol ?? null,
        officialCode: detail.abbreviation?.official ?? null,
        cardCountTotal: detail.cardCount?.total ?? 0,
        cardCountOfficial: detail.cardCount?.official ?? 0,
        updatedAt: new Date(),
      },
    });

  return detail;
}

function resolveCardNamesFromHints(
  hints: LocalizedStrings | undefined,
  cardmarketName: string | null,
  fetchedName: string | null,
  fetchedLang: "de" | "en",
): LocalizedStrings {
  const names: LocalizedStrings = { ...(hints ?? {}) };

  if (cardmarketName && !names.en) {
    names.en = cardmarketName;
  }

  if (fetchedName) {
    const lang = fetchedLang === "de" ? "de" : "en";
    if (!names[lang]) {
      names[lang] = fetchedName;
    }
  }

  return names;
}

async function syncCard(
  cardId: string,
  seriesId: string,
  setId: string,
  hints?: LocalizedStrings,
) {
  const { card, lang } = await fetchCardWithFallback(cardId);
  const imageUrl = buildImageUrl(seriesId, setId, card.localId);
  await cacheCardImage(card.id, imageUrl);

  const cardmarketName = await lookupCardmarketName(
    card.pricing?.cardmarket?.idProduct,
  );
  const incomingNames = resolveCardNamesFromHints(
    hints,
    cardmarketName,
    card.name,
    lang === "de" ? "de" : "en",
  );

  const existing = await db.query.cards.findFirst({
    where: eq(cards.id, card.id),
    columns: { names: true },
  });
  const mergedNames = mergeLocalized(existing?.names ?? {}, incomingNames);
  const canonicalRarity = normalizeRarity(
    card.rarity ?? null,
    lang === CATALOG_FALLBACK_LANG ? "en" : (lang as "de"),
  );

  await db
    .insert(cards)
    .values({
      id: card.id,
      setId,
      number: card.localId,
      names: mergedNames,
      rarity: canonicalRarity,
      imageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        setId,
        number: card.localId,
        names: mergedNames,
        rarity: canonicalRarity,
        imageUrl,
        updatedAt: new Date(),
      },
    });

  await rebuildCardSearchVectors(card.id);

  const variantTypes = deriveVariantTypes(card.variants);
  const pricing = card.pricing?.cardmarket;

  for (const variantType of variantTypes) {
    const variantPricing = pricingForVariant(variantType, pricing, card.variants);

    const [variant] = await db
      .insert(cardVariants)
      .values({
        cardId: card.id,
        variantType,
        cardmarketProductId: variantPricing?.cardmarketProductId ?? null,
      })
      .onConflictDoUpdate({
        target: [cardVariants.cardId, cardVariants.variantType],
        set: {
          cardmarketProductId: variantPricing?.cardmarketProductId ?? null,
        },
      })
      .returning();

    if (variantPricing && (variantPricing.trendEur || variantPricing.lowEur)) {
      await db
        .insert(cardPrices)
        .values({
          variantId: variant.id,
          trendEur: variantPricing.trendEur?.toString() ?? null,
          lowEur: variantPricing.lowEur?.toString() ?? null,
          avgEur: variantPricing.avgEur?.toString() ?? null,
          source: "tcgdex",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: cardPrices.variantId,
          set: {
            trendEur: variantPricing.trendEur?.toString() ?? null,
            lowEur: variantPricing.lowEur?.toString() ?? null,
            avgEur: variantPricing.avgEur?.toString() ?? null,
            source: "tcgdex",
            updatedAt: new Date(),
          },
        });
    }
  }
}

async function syncSetCards(
  setId: string,
  cardErrors: CatalogCardError[],
  onProgress?: (message: string) => Promise<void>,
) {
  const details = await fetchSetAllLangs(setId);
  const { detail, names: setNames } = mergeSetLocalizedFields(details);
  const seriesId = detail.serie?.id ?? "unknown";
  const nameHints = buildMultilangNameHints(details);
  const enDetail = details.get(CATALOG_FALLBACK_LANG);
  const deDetail = details.get("de");
  const cardSummaries =
    deDetail?.cards.length
      ? deDetail.cards
      : enDetail?.cards.length
        ? enDetail.cards
        : detail.cards;

  const cardLimit = getCatalogSetCardLimit();
  const cardsToSync =
    cardLimit != null ? cardSummaries.slice(0, cardLimit) : cardSummaries;

  if (cardLimit != null && cardSummaries.length > cardLimit) {
    console.warn(
      `[catalog] CATALOG_SET_CARD_LIMIT=${cardLimit}: syncing ${cardsToSync.length}/${cardSummaries.length} cards for set ${setId}`,
    );
  }

  const totalCards = cardsToSync.length;

  for (let index = 0; index < cardsToSync.length; index += 1) {
    const cardSummary = cardsToSync[index];
    const localId = decodeTcgdexLocalId(cardSummary.localId);
    const hints = nameHints.get(localId);

    try {
      await syncCard(cardSummary.id, seriesId, detail.id, hints);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Kartenfehler";
      cardErrors.push({
        setId: detail.id,
        setName: getLocalizedString(setNames, "en") ?? detail.name,
        cardId: cardSummary.id,
        error: message,
      });
      console.warn(
        `[catalog] Skipping card ${cardSummary.id} in set ${detail.id}: ${message}`,
      );
    }

    if (onProgress) {
      await onProgress(
        encodeSyncJobMessage("setCardsProgress", {
          current: index + 1,
          total: totalCards,
          name: detail.name,
        }),
      );
    }

    await delay(BATCH_DELAY_MS);
  }

  return detail;
}

function buildJobProgress(
  cardErrors: CatalogCardError[],
  failure?: SyncJobFailure,
): { cardErrors?: CatalogCardError[]; failure?: SyncJobFailure } {
  return {
    ...(cardErrors.length > 0 ? { cardErrors } : {}),
    ...(failure ? { failure } : {}),
  };
}

export async function runSetsSync(jobId?: string) {
  if (jobId) {
    await db
      .update(syncJobs)
      .set({
        status: "running",
        startedAt: new Date(),
        message: encodeSyncJobMessage("catalogStarting"),
      })
      .where(eq(syncJobs.id, jobId));
  }

  try {
    const catalogSetIds = getCatalogSetIdsFilter();
    let allSets = await fetchCatalogSets();

    if (catalogSetIds) {
      allSets = applyCatalogSetFilter(allSets, catalogSetIds);
      console.log(
        `[catalog] Syncing ${allSets.length} set(s) from CATALOG_SET_IDS (${catalogSetIds.length} requested)`,
      );

      if (jobId) {
        await db
          .update(syncJobs)
          .set({
            message: encodeSyncJobMessage("catalogForSetsCount", {
              count: allSets.length,
            }),
          })
          .where(eq(syncJobs.id, jobId));
      }
    }

    for (let index = 0; index < allSets.length; index += 1) {
      const setSummary = allSets[index];

      try {
        await upsertSetMetadata(setSummary);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Set-Fehler";
        console.error(
          `[catalog] Failed to sync set ${setSummary.id}: ${message}`,
        );
        if (jobId) {
          await db
            .update(syncJobs)
            .set({
              status: "failed",
              finishedAt: new Date(),
              progress: buildJobProgress([], {
                kind: "set",
                setId: setSummary.id,
                setName: setSummary.name,
                error: message,
              }),
              message,
            })
            .where(eq(syncJobs.id, jobId));
        }
        throw error;
      }

      if (jobId) {
        await db
          .update(syncJobs)
          .set({
            message: encodeSyncJobMessage("catalogSetProgress", {
              current: index + 1,
              total: allSets.length,
              name: setSummary.name,
            }),
          })
          .where(eq(syncJobs.id, jobId));
      }
    }

    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "completed",
          finishedAt: new Date(),
          progress: buildJobProgress([]),
          message: encodeSyncJobMessage("catalogCompleted", {
            count: allSets.length,
          }),
        })
        .where(eq(syncJobs.id, jobId));
    }

    return { setsProcessed: allSets.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Sets-Sync";
    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "failed",
          finishedAt: new Date(),
          progress: buildJobProgress([], {
            kind: "job",
            error: message,
          }),
          message,
        })
        .where(eq(syncJobs.id, jobId));
    }
    throw error;
  }
}

export async function runSetCardsSync(setId: string, jobId?: string) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    throw new Error(`Set not found: ${setId}`);
  }

  const setDisplayName =
    getLocalizedString(set.names, "en") ?? set.id;

  if (jobId) {
    await db
      .update(syncJobs)
      .set({
        status: "running",
        startedAt: new Date(),
        message: encodeSyncJobMessage("setCardsStarting", {
          setName: setDisplayName,
        }),
      })
      .where(eq(syncJobs.id, jobId));
  }

  const cardErrors: CatalogCardError[] = [];

  try {
    const detail = await syncSetCards(setId, cardErrors, async (message) => {
      if (jobId) {
        await db
          .update(syncJobs)
          .set({ message, progress: buildJobProgress(cardErrors) })
          .where(eq(syncJobs.id, jobId));
      }
    });

    const finishedAt = new Date();

    await db
      .update(sets)
      .set({ cardsSyncedAt: finishedAt, updatedAt: finishedAt })
      .where(eq(sets.id, setId));

    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "completed",
          finishedAt,
          progress: buildJobProgress(cardErrors),
          message:
            cardErrors.length === 0
              ? encodeSyncJobMessage("setCardsCompleted", {
                  setName: detail.name,
                })
              : encodeSyncJobMessage("setCardsCompletedWithSkips", {
                  setName: detail.name,
                  skipped: cardErrors.length,
                }),
        })
        .where(eq(syncJobs.id, jobId));
    }

    if (cardErrors.length > 0) {
      console.warn(
        `[catalog] Set ${setId} completed with ${cardErrors.length} skipped card(s)`,
      );
    }

    return { setId, cardErrors: cardErrors.length };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Karten-Sync";
    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "failed",
          finishedAt: new Date(),
          progress: buildJobProgress(cardErrors, {
            kind: "job",
            setId,
            setName: setDisplayName,
            error: message,
          }),
          message,
        })
        .where(eq(syncJobs.id, jobId));
    }
    throw error;
  }
}

export async function runWeeklyCatalogRefresh() {
  await runSetsSync();

  const syncedSets = await db.query.sets.findMany({
    where: isNotNull(sets.cardsSyncedAt),
    columns: { id: true, names: true },
  });

  let enqueued = 0;

  for (const set of syncedSets) {
    const activeJob = await findActiveSetCardsJob(set.id);
    if (activeJob) {
      continue;
    }

    const [job] = await db
      .insert(syncJobs)
      .values({
        jobType: "set_cards",
        setId: set.id,
        status: "pending",
        message: encodeSyncJobMessage("weeklySetCardsRefresh", {
          setName: getLocalizedString(set.names, "en") ?? set.id,
        }),
      })
      .returning();

    await enqueueSetCardsSync(job.id, set.id);
    enqueued += 1;
  }

  console.log(
    `[catalog] Weekly refresh: metadata updated, ${enqueued} set card job(s) enqueued`,
  );
}

export async function createSetCardsSyncJob(setId: string) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    return { error: "Set nicht gefunden.", status: 404 as const };
  }

  const activeJob = await findActiveSetCardsJob(setId);
  if (activeJob) {
    return {
      error: "Ein Karten-Sync für dieses Set läuft bereits oder wartet in der Queue.",
      job: activeJob,
      status: 409 as const,
    };
  }

  const [job] = await db
    .insert(syncJobs)
    .values({
      jobType: "set_cards",
      setId,
      status: "pending",
    })
    .returning();

  await enqueueSetCardsSync(job.id, setId);

  return { job, status: 202 as const };
}
