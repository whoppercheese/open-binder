import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, collections, sets } from "@/db/schema";
import {
  collectionCoverExists,
  deleteCollectionCoverImage,
  snapshotCollectionCover,
} from "@/lib/image-storage";
import { getCollectionCoverApiPath } from "@/lib/image-paths";
import type { UiLocale } from "@/lib/i18n/locale";
import {
  localizedCardNameSql,
  localizedSetNameSql,
} from "@/lib/localized-names";

type CollectionRow = typeof collections.$inferSelect;

export function resolveCollectionCoverUrl(
  collectionId: string,
  updatedAt?: Date | string,
): string | null {
  if (!collectionCoverExists(collectionId)) {
    return null;
  }

  const version =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : undefined;

  return getCollectionCoverApiPath(collectionId, version);
}

export function getCollectionCoverFields(collection: CollectionRow) {
  return {
    coverCardId: collection.coverCardId,
    coverImageUrl: resolveCollectionCoverUrl(
      collection.id,
      collection.updatedAt,
    ),
  };
}

async function cardIsOnChecklist(collectionId: string, cardId: string) {
  const row = await db.query.collectionCards.findFirst({
    where: and(
      eq(collectionCards.collectionId, collectionId),
      eq(collectionCards.cardId, cardId),
    ),
  });

  return row != null;
}

async function getChecklistCardIdsInDisplayOrder(
  collectionId: string,
  locale: UiLocale,
): Promise<string[]> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });
  if (!collection) {
    return [];
  }

  const cardNameSql = localizedCardNameSql(locale);
  const setNameSql = localizedSetNameSql(locale);

  const rows =
    collection.type === "set" && collection.setId
      ? await db
          .select({ cardId: cards.id })
          .from(collectionCards)
          .innerJoin(cards, eq(collectionCards.cardId, cards.id))
          .innerJoin(sets, eq(cards.setId, sets.id))
          .where(eq(collectionCards.collectionId, collectionId))
          .orderBy(
            sql`case when ${cards.setId} = ${collection.setId} then 0 else 1 end`,
            asc(setNameSql),
            sql`lpad(${cards.number}, 4, '0')`,
            asc(cards.id),
          )
      : await db
          .select({ cardId: cards.id })
          .from(collectionCards)
          .innerJoin(cards, eq(collectionCards.cardId, cards.id))
          .where(eq(collectionCards.collectionId, collectionId))
          .orderBy(asc(cardNameSql), asc(cards.id));

  return rows.map((row) => row.cardId);
}

async function getFirstChecklistCardId(
  collectionId: string,
  locale: UiLocale,
) {
  const [first] = await getChecklistCardIdsInDisplayOrder(collectionId, locale);
  return first ?? null;
}

async function getFallbackChecklistCardId(
  collectionId: string,
  locale: UiLocale,
  excludeCardId?: string,
) {
  const cardIds = await getChecklistCardIdsInDisplayOrder(collectionId, locale);

  for (const cardId of cardIds) {
    if (cardId !== excludeCardId) {
      return cardId;
    }
  }

  return null;
}

async function applyCollectionCover(
  collectionId: string,
  cardId: string,
): Promise<boolean> {
  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
  });
  if (!card) {
    return false;
  }

  const snapshotted = await snapshotCollectionCover(
    collectionId,
    cardId,
    card.imageUrl,
  );
  if (!snapshotted) {
    return false;
  }

  await db
    .update(collections)
    .set({
      coverCardId: cardId,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, collectionId));

  return true;
}

async function clearCollectionCoverState(collectionId: string) {
  await deleteCollectionCoverImage(collectionId);
  await db
    .update(collections)
    .set({
      coverCardId: null,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, collectionId));
}

export async function setCollectionCover(
  collectionId: string,
  cardId: string | null,
  locale: UiLocale = "de",
) {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection) {
    return { error: "COLLECTION_NOT_FOUND" as const };
  }

  if (cardId == null) {
    await clearCollectionCoverState(collectionId);
    if (collection.type === "custom") {
      const fallbackCardId = await getFirstChecklistCardId(collectionId, locale);
      if (fallbackCardId) {
        await applyCollectionCover(collectionId, fallbackCardId);
      }
    }

    const updated = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
    });
    return updated
      ? { collection: updated }
      : { error: "COLLECTION_NOT_FOUND" as const };
  }

  if (!(await cardIsOnChecklist(collectionId, cardId))) {
    return { error: "CARD_NOT_IN_COLLECTION" as const };
  }

  const applied = await applyCollectionCover(collectionId, cardId);
  if (!applied) {
    return { error: "COVER_SNAPSHOT_FAILED" as const };
  }

  const updated = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  return updated
    ? { collection: updated }
    : { error: "COLLECTION_NOT_FOUND" as const };
}

export async function maybeAutoSetCollectionCover(
  collectionId: string,
  cardId: string,
) {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.type !== "custom") {
    return;
  }

  if (collection.coverCardId != null || collectionCoverExists(collectionId)) {
    return;
  }

  if (!(await cardIsOnChecklist(collectionId, cardId))) {
    return;
  }

  await applyCollectionCover(collectionId, cardId);
}

export async function refreshCollectionCoverAfterRemoval(
  collectionId: string,
  removedCardId: string,
  locale: UiLocale = "de",
) {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection) {
    return;
  }

  if (collection.coverCardId !== removedCardId) {
    return;
  }

  await clearCollectionCoverState(collectionId);

  if (collection.type === "custom") {
    const fallbackCardId = await getFallbackChecklistCardId(
      collectionId,
      locale,
      removedCardId,
    );
    if (fallbackCardId) {
      await applyCollectionCover(collectionId, fallbackCardId);
    }
  }
}

export async function deleteCollectionCoverAssets(collectionId: string) {
  await deleteCollectionCoverImage(collectionId);
}
