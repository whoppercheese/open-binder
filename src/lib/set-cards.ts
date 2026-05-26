import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardVariants, sets, userCards } from "@/db/schema";
import { deleteCardImage } from "@/lib/image-storage";

export async function getSetCollectionEntryCount(
  setId: string,
  collectionId?: string,
): Promise<number> {
  const filters = [eq(cards.setId, setId)];
  if (collectionId) {
    filters.push(eq(userCards.collectionId, collectionId));
  }

  const [row] = await db
    .select({
      count: sql<number>`count(${userCards.id})::int`,
    })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .where(and(...filters));

  return Number(row?.count ?? 0);
}

export async function clearSetCardData(setId: string) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });
  if (!set) {
    return null;
  }

  const collectionEntryCount = await getSetCollectionEntryCount(setId);

  const cardRows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.setId, setId));

  const cardIds = cardRows.map((row) => row.id);

  if (cardIds.length > 0) {
    await db.delete(cards).where(eq(cards.setId, setId));
  }

  await db
    .update(sets)
    .set({ cardsSyncedAt: null, updatedAt: new Date() })
    .where(eq(sets.id, setId));

  await Promise.all(cardIds.map((cardId) => deleteCardImage(cardId)));

  return {
    deletedCardCount: cardIds.length,
    deletedCollectionEntries: collectionEntryCount,
  };
}
