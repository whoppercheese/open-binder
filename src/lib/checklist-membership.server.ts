import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cards,
  collectionCards,
  collections,
} from "@/db/schema";
import { addCardToCollectionChecklist } from "@/lib/collections.server";
import { getCollectionCoverFields } from "@/lib/collection-cover.server";
import { DEFAULT_LOCALE, type UiLocale } from "@/lib/i18n/locale";
import { getLocalizedName } from "@/lib/localized-names";

/** Collections containing the card on their checklist. */
export async function getChecklistCountsForCardIds(
  cardIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (cardIds.length === 0) {
    return counts;
  }

  const uniqueIds = [...new Set(cardIds)];
  const rows = await db
    .select({
      cardId: collectionCards.cardId,
      count: sql<number>`count(*)::int`,
    })
    .from(collectionCards)
    .where(inArray(collectionCards.cardId, uniqueIds))
    .groupBy(collectionCards.cardId);

  for (const row of rows) {
    counts.set(row.cardId, Number(row.count));
  }

  return counts;
}

export type ChecklistCollectionOption = {
  id: string;
  name: string;
  type: "set" | "custom";
  setId: string | null;
  imageUrl: string | null;
  coverImageUrl: string | null;
  onChecklist: boolean;
  locked: boolean;
};

export async function getCardChecklistMembership(
  cardId: string,
  locale: UiLocale = DEFAULT_LOCALE,
) {
  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
    columns: { id: true, setId: true, names: true, number: true },
  });

  if (!card) {
    return { error: "CARD_NOT_FOUND" as const };
  }

  const allCollections = await db.query.collections.findMany({
    orderBy: [desc(collections.updatedAt)],
  });

  const onChecklist = new Set<string>();
  const membershipRows = await db
    .select({ collectionId: collectionCards.collectionId })
    .from(collectionCards)
    .where(eq(collectionCards.cardId, cardId));

  for (const row of membershipRows) {
    onChecklist.add(row.collectionId);
  }

  const options: ChecklistCollectionOption[] = [];

  for (const collection of allCollections) {
    const isOnChecklist = onChecklist.has(collection.id);
    options.push({
      id: collection.id,
      name: collection.name,
      type: collection.type,
      setId: collection.type === "set" ? collection.setId : null,
      imageUrl: collection.imageUrl,
      coverImageUrl: getCollectionCoverFields(collection).coverImageUrl,
      onChecklist: isOnChecklist,
      locked: isOnChecklist,
    });
  }

  return {
    cardId: card.id,
    setId: card.setId,
    cardName: getLocalizedName(card.names, locale),
    cardNumber: card.number,
    collections: options,
  };
}

export async function addCardToChecklists(
  cardId: string,
  collectionIds: string[],
) {
  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
    columns: { id: true },
  });

  if (!card) {
    return { error: "CARD_NOT_FOUND" as const };
  }

  const uniqueIds = [...new Set(collectionIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const rows = await db.query.collections.findMany({
    where: inArray(collections.id, uniqueIds),
    columns: { id: true, type: true },
  });

  const membership = await getCardChecklistMembership(cardId);
  if ("error" in membership) {
    return membership;
  }

  const lockedIds = new Set(
    membership.collections.filter((item) => item.locked).map((item) => item.id),
  );

  let added = 0;
  let skipped = 0;

  for (const collection of rows) {
    if (lockedIds.has(collection.id)) {
      skipped += 1;
      continue;
    }

    const result = await addCardToCollectionChecklist(collection.id, cardId);
    if ("error" in result) {
      return result;
    }
    added += 1;
  }

  return { added, skipped };
}

export type BulkChecklistCollectionOption = ChecklistCollectionOption & {
  cardsOnChecklist: number;
  totalCards: number;
};

export async function getBulkChecklistMembership(cardIds: readonly string[]) {
  const uniqueCardIds = [...new Set(cardIds.filter(Boolean))];
  if (uniqueCardIds.length === 0) {
    return { cardIds: [], collections: [] as BulkChecklistCollectionOption[] };
  }

  const allCollections = await db.query.collections.findMany({
    orderBy: [desc(collections.updatedAt)],
  });

  const membershipRows = await db
    .select({
      collectionId: collectionCards.collectionId,
      cardId: collectionCards.cardId,
    })
    .from(collectionCards)
    .where(inArray(collectionCards.cardId, uniqueCardIds));

  const countByCollection = new Map<string, number>();
  for (const row of membershipRows) {
    countByCollection.set(
      row.collectionId,
      (countByCollection.get(row.collectionId) ?? 0) + 1,
    );
  }

  const totalCards = uniqueCardIds.length;
  const options: BulkChecklistCollectionOption[] = allCollections.map(
    (collection) => {
      const cardsOnChecklist = countByCollection.get(collection.id) ?? 0;
      const allOnChecklist = cardsOnChecklist >= totalCards;

      return {
        id: collection.id,
        name: collection.name,
        type: collection.type,
        setId: collection.type === "set" ? collection.setId : null,
        imageUrl: collection.imageUrl,
        coverImageUrl: getCollectionCoverFields(collection).coverImageUrl,
        onChecklist: allOnChecklist,
        locked: allOnChecklist,
        cardsOnChecklist,
        totalCards,
      };
    },
  );

  return { cardIds: uniqueCardIds, collections: options };
}

export async function addCardsToChecklists(
  cardIds: readonly string[],
  collectionIds: readonly string[],
) {
  const uniqueCardIds = [...new Set(cardIds.filter(Boolean))];
  const uniqueCollectionIds = [...new Set(collectionIds.filter(Boolean))];

  if (uniqueCardIds.length === 0 || uniqueCollectionIds.length === 0) {
    return { added: 0, skipped: 0, checklistCounts: new Map<string, number>() };
  }

  const existingCards = await db.query.cards.findMany({
    where: inArray(cards.id, uniqueCardIds),
    columns: { id: true },
  });
  const existingCardIds = new Set(existingCards.map((row) => row.id));
  const missingCardIds = uniqueCardIds.filter((id) => !existingCardIds.has(id));

  if (missingCardIds.length > 0) {
    return {
      error: "CARDS_NOT_FOUND" as const,
      missingCardIds,
    };
  }

  const collectionRows = await db.query.collections.findMany({
    where: inArray(collections.id, uniqueCollectionIds),
    columns: { id: true },
  });

  if (collectionRows.length === 0) {
    return { error: "COLLECTION_NOT_FOUND" as const };
  }

  const membershipRows = await db
    .select({
      collectionId: collectionCards.collectionId,
      cardId: collectionCards.cardId,
    })
    .from(collectionCards)
    .where(
      and(
        inArray(collectionCards.cardId, uniqueCardIds),
        inArray(collectionCards.collectionId, uniqueCollectionIds),
      ),
    );

  const existingPairs = new Set(
    membershipRows.map((row) => `${row.collectionId}:${row.cardId}`),
  );

  let added = 0;
  let skipped = 0;

  for (const collection of collectionRows) {
    for (const cardId of uniqueCardIds) {
      const pairKey = `${collection.id}:${cardId}`;
      if (existingPairs.has(pairKey)) {
        skipped += 1;
        continue;
      }

      const result = await addCardToCollectionChecklist(collection.id, cardId);
      if ("error" in result) {
        return { error: result.error };
      }

      added += 1;
      existingPairs.add(pairKey);
    }
  }

  const checklistCounts = await getChecklistCountsForCardIds(uniqueCardIds);

  return { added, skipped, checklistCounts };
}
