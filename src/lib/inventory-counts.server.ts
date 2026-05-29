import "server-only";

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardVariants, userCards } from "@/db/schema";

export async function getInventoryCountsForCardIds(
  cardIds: readonly string[],
): Promise<Map<string, number>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      cardId: cards.id,
      totalQuantity: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int`,
    })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .where(inArray(cards.id, cardIds))
    .groupBy(cards.id);

  return new Map(
    rows.map((row) => [row.cardId, Number(row.totalQuantity)]),
  );
}
