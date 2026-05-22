import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardPrices,
  cardVariants,
  cardmarketProducts,
  cards,
  syncJobs,
  userCards,
} from "@/db/schema";
import { fetchProductCatalog } from "@/lib/cardmarket";
import {
  delay,
  fetchCardWithFallback,
  pricingForVariant,
  type VariantType,
} from "@/lib/tcgdex";

const BATCH_DELAY_MS = 150;
const MAX_CARDS_PER_RUN = 500;

async function refreshCardPricing(cardId: string) {
  const { card } = await fetchCardWithFallback(cardId);
  const pricing = card.pricing?.cardmarket;
  if (!pricing) return false;

  const variants = await db.query.cardVariants.findMany({
    where: eq(cardVariants.cardId, cardId),
  });

  for (const variant of variants) {
    const variantPricing = pricingForVariant(
      variant.variantType as VariantType,
      pricing,
    );
    if (!variantPricing) continue;

    await db
      .update(cardVariants)
      .set({
        cardmarketProductId:
          variantPricing.cardmarketProductId ?? variant.cardmarketProductId,
      })
      .where(eq(cardVariants.id, variant.id));

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

  return true;
}

async function importCardmarketCatalog(jobId?: string) {
  const catalog = await fetchProductCatalog();

  const chunkSize = 500;
  for (let i = 0; i < catalog.products.length; i += chunkSize) {
    const chunk = catalog.products.slice(i, i + chunkSize);
    await db
      .insert(cardmarketProducts)
      .values(
        chunk.map((product) => ({
          idProduct: product.idProduct,
          name: product.name,
          idExpansion: product.idExpansion,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: cardmarketProducts.idProduct,
        set: {
          name: sql`excluded.name`,
          idExpansion: sql`excluded.id_expansion`,
          updatedAt: new Date(),
        },
      });

    if (jobId) {
      await db
        .update(syncJobs)
        .set({
          message: `Cardmarket Katalog: ${Math.min(i + chunkSize, catalog.products.length)}/${catalog.products.length}`,
        })
        .where(eq(syncJobs.id, jobId));
    }
  }

  return catalog.products.length;
}

export async function runPriceSync(jobId?: string) {
  if (jobId) {
    await db
      .update(syncJobs)
      .set({ status: "running", startedAt: new Date(), message: "Starte Preis-Sync…" })
      .where(eq(syncJobs.id, jobId));
  }

  try {
    await importCardmarketCatalog(jobId);

    const ownedCardIds = await db
      .selectDistinct({ cardId: cards.id })
      .from(userCards)
      .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
      .innerJoin(cards, eq(cardVariants.cardId, cards.id))
      .limit(MAX_CARDS_PER_RUN);

    const cardIds = ownedCardIds.map((row) => row.cardId);

    if (cardIds.length === 0) {
      if (jobId) {
        await db
          .update(syncJobs)
          .set({
            status: "completed",
            finishedAt: new Date(),
            message: "Preis-Sync abgeschlossen (keine Karten in der Sammlung).",
          })
          .where(eq(syncJobs.id, jobId));
      }
      return { cardsUpdated: 0 };
    }

    let updated = 0;
    for (const cardId of cardIds) {
      const success = await refreshCardPricing(cardId);
      if (success) updated += 1;
      await delay(BATCH_DELAY_MS);

      if (jobId) {
        await db
          .update(syncJobs)
          .set({
            message: `Preise aktualisiert: ${updated}/${cardIds.length}`,
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
          message: `Preis-Sync abgeschlossen (${updated} Karten).`,
        })
        .where(eq(syncJobs.id, jobId));
    }

    return { cardsUpdated: updated };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Preis-Sync";
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

export async function refreshPricingForSet(setId: string) {
  const setCards = await db.query.cards.findMany({
    where: eq(cards.setId, setId),
    columns: { id: true },
  });

  for (const card of setCards) {
    await refreshCardPricing(card.id);
    await delay(BATCH_DELAY_MS);
  }
}

export async function getOwnedVariantIds() {
  const rows = await db
    .select({ variantId: userCards.variantId })
    .from(userCards);
  return rows.map((row) => row.variantId);
}

export async function getStaleOwnedCardIds(limit = MAX_CARDS_PER_RUN) {
  const rows = await db
    .selectDistinct({ cardId: cards.id })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(
      sql`${cardPrices.updatedAt} IS NULL OR ${cardPrices.updatedAt} < NOW() - INTERVAL '1 day'`,
    )
    .limit(limit);

  if (rows.length > 0) {
    return rows.map((row) => row.cardId);
  }

  const fallback = await db
    .selectDistinct({ cardId: cards.id })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .limit(limit);

  return fallback.map((row) => row.cardId);
}
