import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardPrices,
  cards,
  cardVariants,
  sets,
  syncJobs,
} from "@/db/schema";
import {
  buildImageUrl,
  CATALOG_LANG,
  delay,
  deriveVariantTypes,
  fetchCardWithFallback,
  fetchSet,
  fetchSets,
  pricingForVariant,
  resolveSetCardSummaries,
} from "@/lib/tcgdex";
import { cacheCardImage, cacheSetImage } from "@/lib/image-storage";
import {
  appendCatalogProgress,
  getResumeProcessedSetIds,
} from "@/jobs/sync-job-utils";

const BATCH_DELAY_MS = 120;

async function upsertSet(
  summary: Awaited<ReturnType<typeof fetchSets>>[number],
) {
  const detail = await fetchSet(summary.id);
  const seriesId = detail.serie?.id ?? summary.serie?.id ?? "unknown";
  const seriesName = detail.serie?.name ?? summary.serie?.name ?? "Unbekannt";

  if (detail.logo) {
    await cacheSetImage(detail.id, "logo", detail.logo);
  }
  if (detail.symbol) {
    await cacheSetImage(detail.id, "symbol", detail.symbol);
  }

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

  const cardSummaries = await resolveSetCardSummaries(detail.id, detail);

  for (const cardSummary of cardSummaries) {
    await syncCard(cardSummary.id, seriesId, detail.id);
    await delay(BATCH_DELAY_MS);
  }
}

async function syncCard(cardId: string, seriesId: string, setId: string) {
  const card = await fetchCardWithFallback(cardId);
  const imageUrl = buildImageUrl(seriesId, setId, card.localId);
  await cacheCardImage(card.id, imageUrl);

  await db
    .insert(cards)
    .values({
      id: card.id,
      setId,
      number: card.localId,
      nameDe: card.name,
      rarity: card.rarity ?? null,
      imageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        setId,
        number: card.localId,
        nameDe: card.name,
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

export async function runCatalogSync(jobId?: string) {
  if (jobId) {
    await db
      .update(syncJobs)
      .set({ status: "running", startedAt: new Date(), message: "Starte Katalog-Sync…" })
      .where(eq(syncJobs.id, jobId));
  }

  try {
    const allSets = await fetchSets(CATALOG_LANG);
    const resumedSetIds = jobId
      ? new Set(await getResumeProcessedSetIds(jobId, "catalog"))
      : new Set<string>();
    const setsToProcess = allSets.filter((set) => !resumedSetIds.has(set.id));
    let processedSetIds = Array.from(resumedSetIds);
    let processed = resumedSetIds.size;

    if (jobId && resumedSetIds.size > 0) {
      await db
        .update(syncJobs)
        .set({
          message: `Setzt fort bei ${processed + 1}/${allSets.length} (${resumedSetIds.size} Sets übersprungen)…`,
        })
        .where(eq(syncJobs.id, jobId));
    }

    for (const setSummary of setsToProcess) {
      await upsertSet(setSummary);
      processed += 1;

      if (jobId) {
        processedSetIds = await appendCatalogProgress(
          jobId,
          setSummary.id,
          processedSetIds,
          `Set ${processed}/${allSets.length}: ${setSummary.name}`,
        );
      }
    }

    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "completed",
          finishedAt: new Date(),
          progress: { processedSetIds: allSets.map((set) => set.id) },
          message: `Katalog-Sync abgeschlossen (${allSets.length} Sets).`,
        })
        .where(eq(syncJobs.id, jobId));
    }

    return { setsProcessed: allSets.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Katalog-Sync";
    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          status: "failed",
          finishedAt: new Date(),
          message,
        })
        .where(eq(syncJobs.id, jobId));
    }
    throw error;
  }
}
