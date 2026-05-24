import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cardPrices, cardVariants } from "@/db/schema";
import { pricingForVariant, type VariantType } from "@/lib/tcgdex";

type VariantPricing = ReturnType<typeof pricingForVariant>;

export async function upsertVariantPricing(
  variantId: string,
  variantPricing: NonNullable<VariantPricing>,
) {
  await db
    .insert(cardPrices)
    .values({
      variantId,
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

export async function upsertVariantWithPricing(
  cardId: string,
  variantType: VariantType,
  variantPricing: VariantPricing,
) {
  const [variant] = await db
    .insert(cardVariants)
    .values({
      cardId,
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
    await upsertVariantPricing(variant.id, variantPricing);
  }

  return variant;
}

export async function updateVariantPricing(
  variant: { id: string; variantType: string; cardmarketProductId: number | null },
  variantPricing: NonNullable<VariantPricing>,
) {
  await db
    .update(cardVariants)
    .set({
      cardmarketProductId:
        variantPricing.cardmarketProductId ?? variant.cardmarketProductId,
    })
    .where(eq(cardVariants.id, variant.id));

  await upsertVariantPricing(variant.id, variantPricing);
}
