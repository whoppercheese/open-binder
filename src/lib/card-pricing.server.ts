import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cardVariants } from "@/db/schema";
import type { VariantType } from "@/lib/tcgdex";

export async function upsertVariantWithCardmarketId(
  cardId: string,
  variantType: VariantType,
  cardmarketProductId: number | null,
) {
  const [variant] = await db
    .insert(cardVariants)
    .values({
      cardId,
      variantType,
      cardmarketProductId: cardmarketProductId ?? null,
    })
    .onConflictDoUpdate({
      target: [cardVariants.cardId, cardVariants.variantType],
      set: {
        cardmarketProductId: cardmarketProductId ?? null,
      },
    })
    .returning();

  return variant!;
}

export async function updateVariantCardmarketId(
  variantId: string,
  cardmarketProductId: number | null,
) {
  await db
    .update(cardVariants)
    .set({ cardmarketProductId: cardmarketProductId ?? null })
    .where(eq(cardVariants.id, variantId));
}
