import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardPrices,
  cardmarketProducts,
  cards,
  cardVariants,
  sets,
  syncJobs,
} from "@/db/schema";
import { resolveCardNames } from "@/lib/card-names";
import {
  buildImageUrl,
  CATALOG_LANG,
  decodeTcgdexLocalId,
  delay,
  deriveVariantTypes,
  fetchCardWithFallback,
  fetchSetBundle,
  fetchSets,
  pricingForVariant,
  type TcgdexSetDetail,
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
import {
  appendCatalogProgress,
  getResumeProcessedSetIds,
} from "@/jobs/sync-job-utils";
import type {
  CatalogCardError,
  SyncJobFailure,
} from "@/lib/sync-job-display";

const BATCH_DELAY_MS = 120;

function getCatalogSkipSets(): number {
  const raw = process.env.CATALOG_SKIP_SETS;
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

async function upsertSet(
  summary: Awaited<ReturnType<typeof fetchSets>>[number],
  cardErrors: CatalogCardError[],
) {
  const { deDetail, enDetail, nameHints, cardSummaries } = await fetchSetBundle(summary.id);
  const detail = deDetail;
  const seriesId = detail.serie?.id ?? summary.serie?.id ?? "unknown";
  const seriesName = detail.serie?.name ?? summary.serie?.name ?? "Unbekannt";

  await syncSetImages(detail, enDetail);

  await db
    .insert(sets)
    .values({
      id: detail.id,
      nameDe: detail.name,
      seriesId,
      seriesName,
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
        nameDe: detail.name,
        seriesId,
        seriesName,
        releaseDate: detail.releaseDate ?? null,
        logoUrl: detail.logo ?? null,
        symbolUrl: detail.symbol ?? null,
        officialCode: detail.abbreviation?.official ?? null,
        cardCountTotal: detail.cardCount?.total ?? 0,
        cardCountOfficial: detail.cardCount?.official ?? 0,
        updatedAt: new Date(),
      },
    });

  for (const cardSummary of cardSummaries) {
    const localId = decodeTcgdexLocalId(cardSummary.localId);
    const hints = nameHints.get(localId);

    try {
      await syncCard(
        cardSummary.id,
        seriesId,
        detail.id,
        hints,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Kartenfehler";
      cardErrors.push({
        setId: detail.id,
        setName: detail.name,
        cardId: cardSummary.id,
        error: message,
      });
      console.warn(
        `[catalog] Skipping card ${cardSummary.id} in set ${detail.id}: ${message}`,
      );
    }

    await delay(BATCH_DELAY_MS);
  }
}

async function syncCard(
  cardId: string,
  seriesId: string,
  setId: string,
  hints?: { de?: string; en?: string },
) {
  const { card, lang } = await fetchCardWithFallback(cardId);
  const imageUrl = buildImageUrl(seriesId, setId, card.localId);
  await cacheCardImage(card.id, imageUrl);

  const cardmarketName = await lookupCardmarketName(
    card.pricing?.cardmarket?.idProduct,
  );
  const names = resolveCardNames({
    deName: hints?.de,
    enName: hints?.en,
    cardmarketName,
    fetchedName: card.name,
    fetchedLang: lang === CATALOG_LANG ? "de" : "en",
  });

  await db
    .insert(cards)
    .values({
      id: card.id,
      setId,
      number: card.localId,
      nameDe: names.nameDe,
      nameEn: names.nameEn,
      nameSource: names.nameSource,
      rarity: card.rarity ?? null,
      imageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        setId,
        number: card.localId,
        nameDe: names.nameDe,
        nameEn: names.nameEn,
        nameSource: names.nameSource,
        rarity: card.rarity ?? null,
        imageUrl,
        updatedAt: new Date(),
      },
    });

  await db.execute(sql`
    UPDATE cards c
    SET search_vector = to_tsvector(
      'german',
      coalesce(c.name_de, '') || ' ' ||
      coalesce(c.name_en, '') || ' ' ||
      coalesce(c.number, '') || ' ' ||
      coalesce(s.name_de, '') || ' ' ||
      coalesce(s.official_code, '')
    )
    FROM sets s
    WHERE c.id = ${card.id}
      AND s.id = c.set_id
  `);

  const variantTypes = deriveVariantTypes(card.variants);
  const pricing = card.pricing?.cardmarket;

  for (const variantType of variantTypes) {
    const variantPricing = pricingForVariant(variantType, pricing);

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

function buildJobProgress(
  processedSetIds: string[],
  cardErrors: CatalogCardError[],
  failure?: SyncJobFailure,
) {
  return {
    processedSetIds,
    ...(cardErrors.length > 0 ? { cardErrors } : {}),
    ...(failure ? { failure } : {}),
  };
}

function buildCompletionMessage(
  setCount: number,
  cardErrors: CatalogCardError[],
): string {
  if (cardErrors.length === 0) {
    return `Katalog-Sync abgeschlossen (${setCount} Sets).`;
  }

  return `Katalog-Sync abgeschlossen (${setCount} Sets, ${cardErrors.length} Karte(n) übersprungen).`;
}

export async function runCatalogSync(jobId?: string) {
  if (jobId) {
    await db
      .update(syncJobs)
      .set({ status: "running", startedAt: new Date(), message: "Starte Katalog-Sync…" })
      .where(eq(syncJobs.id, jobId));
  }

  const cardErrors: CatalogCardError[] = [];
  let processedSetIds: string[] = [];

  try {
    const allSets = await fetchSets(CATALOG_LANG);
    const resumedSetIds = jobId
      ? new Set(await getResumeProcessedSetIds(jobId, "catalog"))
      : new Set<string>();
    let setsToProcess = allSets.filter((set) => !resumedSetIds.has(set.id));
    processedSetIds = Array.from(resumedSetIds);
    let processed = resumedSetIds.size;

    const skipSets = getCatalogSkipSets();
    if (skipSets > 0 && resumedSetIds.size === 0) {
      const setsToSkip = setsToProcess.slice(0, skipSets);
      setsToProcess = setsToProcess.slice(skipSets);

      console.log(
        `[catalog] Skipping first ${setsToSkip.length} set(s) (CATALOG_SKIP_SETS=${skipSets})`,
      );

      if (jobId) {
        await db
          .update(syncJobs)
          .set({
            message: `Überspringe ${setsToSkip.length} Sets (Testmodus)…`,
          })
          .where(eq(syncJobs.id, jobId));
      }

      for (const setSummary of setsToSkip) {
        processed += 1;
        if (jobId) {
          processedSetIds = await appendCatalogProgress(
            jobId,
            setSummary.id,
            processedSetIds,
            `Set ${processed}/${allSets.length}: ${setSummary.name} (übersprungen)`,
            cardErrors,
          );
        } else {
          processedSetIds.push(setSummary.id);
        }
      }
    }

    if (jobId && resumedSetIds.size > 0) {
      await db
        .update(syncJobs)
        .set({
          message: `Setzt fort bei ${processed + 1}/${allSets.length} (${resumedSetIds.size} Sets übersprungen)…`,
        })
        .where(eq(syncJobs.id, jobId));
    }

    for (const setSummary of setsToProcess) {
      try {
        await upsertSet(setSummary, cardErrors);
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
              progress: buildJobProgress(processedSetIds, cardErrors, {
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

      processed += 1;

      if (jobId) {
        processedSetIds = await appendCatalogProgress(
          jobId,
          setSummary.id,
          processedSetIds,
          `Set ${processed}/${allSets.length}: ${setSummary.name}`,
          cardErrors,
        );
      }
    }

    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "completed",
          finishedAt: new Date(),
          progress: buildJobProgress(
            allSets.map((set) => set.id),
            cardErrors,
          ),
          message: buildCompletionMessage(allSets.length, cardErrors),
        })
        .where(eq(syncJobs.id, jobId));
    }

    if (cardErrors.length > 0) {
      console.warn(
        `[catalog] Completed with ${cardErrors.length} skipped card(s)`,
      );
    }

    return { setsProcessed: allSets.length, cardErrors: cardErrors.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Katalog-Sync";
    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "failed",
          finishedAt: new Date(),
          progress: buildJobProgress(processedSetIds, cardErrors, {
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
