import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardVariants,
  cardmarketProducts,
  cards,
  syncJobs,
  userCards,
} from "@/db/schema";
import { updateVariantPricing } from "@/lib/card-pricing.server";
import { fetchProductCatalog } from "@/lib/cardmarket";
import {
  delay,
  fetchCardWithFallback,
  pricingForVariant,
  type VariantType,
} from "@/lib/tcgdex";
import { encodeSyncJobMessage } from "@/lib/sync-job-messages";
import { withSyncJob } from "@/jobs/sync-job-utils";

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
      card.variants,
    );
    if (!variantPricing) continue;

    await updateVariantPricing(variant, variantPricing);
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
          message: encodeSyncJobMessage("cardmarketCatalogProgress", {
            current: Math.min(i + chunkSize, catalog.products.length),
            total: catalog.products.length,
          }),
        })
        .where(eq(syncJobs.id, jobId));
    }
  }

  return catalog.products.length;
}

export async function runPriceSync(jobId?: string) {
  return withSyncJob({
    jobId,
    onStart: () => encodeSyncJobMessage("pricesStarting"),
    run: async () => {
      await importCardmarketCatalog(jobId);

      const ownedCardIds = await db
        .selectDistinct({ cardId: cards.id })
        .from(userCards)
        .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
        .innerJoin(cards, eq(cardVariants.cardId, cards.id))
        .limit(MAX_CARDS_PER_RUN);

      const cardIds = ownedCardIds.map((row) => row.cardId);

      if (cardIds.length === 0) {
        return { cardsUpdated: 0, empty: true as const };
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
              message: encodeSyncJobMessage("pricesUpdatedProgress", {
                updated,
                total: cardIds.length,
              }),
            })
            .where(eq(syncJobs.id, jobId));
        }
      }

      return { cardsUpdated: updated, empty: false as const };
    },
    onComplete: (result) => ({
      message:
        result.empty
          ? encodeSyncJobMessage("pricesCompletedEmpty")
          : encodeSyncJobMessage("pricesCompleted", {
              count: result.cardsUpdated,
            }),
    }),
    onError: (error) => ({
      message:
        error instanceof Error ? error.message : "Unbekannter Fehler beim Preis-Sync",
    }),
  });
}
