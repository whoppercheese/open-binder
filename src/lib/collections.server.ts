import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cards,
  collectionCards,
  collections,
  cardPrices,
  cardVariants,
  sets,
  userCards,
} from "@/db/schema";
import { buildCardVariantEntry } from "@/lib/card-variants.server";
import {
  deleteCollectionCoverAssets,
  getCollectionCoverFields,
  maybeAutoSetCollectionCover,
  refreshCollectionCoverAfterRemoval,
} from "@/lib/collection-cover.server";
import { getLocalizedString } from "@/lib/catalog-languages";
import {
  localizedCardNameSql,
  localizedSetNameSql,
  UNKNOWN_LABEL,
} from "@/lib/localized-names";
import type { UiLocale } from "@/lib/i18n/locale";
import { getPricePreference, pickPrice } from "@/lib/settings";

export type CollectionRow = typeof collections.$inferSelect;

export async function getCollectionById(id: string) {
  return db.query.collections.findFirst({
    where: eq(collections.id, id),
  });
}

export async function getCollectionEntryCount(collectionId: string): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(${userCards.id})::int`,
    })
    .from(userCards)
    .where(eq(userCards.collectionId, collectionId));

  return Number(row?.count ?? 0);
}

async function populateSetCollectionChecklist(
  collectionId: string,
  setId: string,
) {
  const setCards = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.setId, setId));

  if (setCards.length === 0) {
    return;
  }

  await db
    .insert(collectionCards)
    .values(
      setCards.map((card) => ({
        collectionId,
        cardId: card.id,
      })),
    )
    .onConflictDoNothing();
}

export async function getCollectionProgress(
  collection: CollectionRow,
): Promise<{ ownedCount: number; totalCount: number; percent: number }> {
  const [totalRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(collectionCards)
    .where(eq(collectionCards.collectionId, collection.id));

  const totalCount = Number(totalRow?.count ?? 0);

  if (totalCount === 0) {
    return { ownedCount: 0, totalCount: 0, percent: 0 };
  }

  const ownedRows = await db
    .select({ cardId: cards.id })
    .from(collectionCards)
    .innerJoin(cards, eq(collectionCards.cardId, cards.id))
    .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
    .innerJoin(
      userCards,
      and(
        eq(userCards.variantId, cardVariants.id),
        eq(userCards.collectionId, collection.id),
      ),
    )
    .where(eq(collectionCards.collectionId, collection.id))
    .groupBy(cards.id)
    .having(sql`sum(${userCards.quantity}) > 0`);

  const ownedCount = ownedRows.length;

  return {
    ownedCount,
    totalCount,
    percent: totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0,
  };
}

export async function listCollections(locale: UiLocale) {
  const rows = await db.query.collections.findMany();

  const setIds = rows
    .map((row) => row.setId)
    .filter((id): id is string => id != null);

  const setRows =
    setIds.length > 0
      ? await db.query.sets.findMany({
          where: inArray(sets.id, setIds),
        })
      : [];

  const setById = new Map(setRows.map((set) => [set.id, set]));

  const items = await Promise.all(
    rows.map(async (row) => {
      const progress = await getCollectionProgress(row);
      const setMeta = row.setId ? setById.get(row.setId) : undefined;

      return {
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        ...getCollectionCoverFields(row),
        type: row.type,
        setId: row.setId,
        setOfficialCode: setMeta?.officialCode ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...progress,
      };
    }),
  );

  return items.sort(
    (a, b) =>
      b.percent - a.percent ||
      b.ownedCount - a.ownedCount ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function createSetCollection(
  setId: string,
  locale: UiLocale,
  nameOverride?: string,
) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    return { error: "SET_NOT_FOUND" as const };
  }

  if (!set.cardsSyncedAt) {
    return { error: "SET_NOT_SYNCED" as const };
  }

  const [cardCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cards)
    .where(eq(cards.setId, setId));

  if (Number(cardCount?.count ?? 0) === 0) {
    return { error: "SET_HAS_NO_CARDS" as const };
  }

  const name =
    nameOverride?.trim() ||
    getLocalizedString(set.names, locale) ||
    UNKNOWN_LABEL;

  const [created] = await db
    .insert(collections)
    .values({
      name,
      imageUrl: null,
      type: "set",
      setId,
      updatedAt: new Date(),
    })
    .returning();

  await populateSetCollectionChecklist(created!.id, setId);

  return { collection: created! };
}

export async function createCustomCollection(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "NAME_REQUIRED" as const };
  }

  const [created] = await db
    .insert(collections)
    .values({
      name: trimmed,
      imageUrl: null,
      type: "custom",
      setId: null,
      updatedAt: new Date(),
    })
    .returning();

  return { collection: created! };
}

export async function updateCollectionMeta(
  id: string,
  input: { name?: string },
) {
  const trimmed = input.name?.trim();
  const updates: Partial<typeof collections.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (trimmed !== undefined) {
    if (!trimmed) {
      return { error: "NAME_REQUIRED" as const };
    }
    updates.name = trimmed;
  }

  const [updated] = await db
    .update(collections)
    .set(updates)
    .where(eq(collections.id, id))
    .returning();

  if (!updated) {
    return { error: "COLLECTION_NOT_FOUND" as const };
  }

  return { collection: updated };
}

export async function deleteCollectionById(id: string) {
  await deleteCollectionCoverAssets(id);

  const deleted = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning({ id: collections.id });

  return deleted.length > 0;
}

export async function addCardToCollectionChecklist(
  collectionId: string,
  cardId: string,
) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return { error: "COLLECTION_NOT_FOUND" as const };
  }

  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
  });
  if (!card) {
    return { error: "CARD_NOT_FOUND" as const };
  }

  await db
    .insert(collectionCards)
    .values({ collectionId, cardId })
    .onConflictDoNothing();

  await maybeAutoSetCollectionCover(collectionId, cardId);

  await db
    .update(collections)
    .set({ updatedAt: new Date() })
    .where(eq(collections.id, collectionId));

  return { ok: true as const };
}

export async function removeCardFromCollectionChecklist(
  collectionId: string,
  cardId: string,
  locale: UiLocale = "de",
) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return { error: "COLLECTION_NOT_FOUND" as const };
  }

  const variantRows = await db
    .select({ id: cardVariants.id })
    .from(cardVariants)
    .where(eq(cardVariants.cardId, cardId));

  const variantIds = variantRows.map((row) => row.id);
  if (variantIds.length > 0) {
    await db
      .delete(userCards)
      .where(
        and(
          eq(userCards.collectionId, collectionId),
          inArray(userCards.variantId, variantIds),
        ),
      );
  }

  await db
    .delete(collectionCards)
    .where(
      and(
        eq(collectionCards.collectionId, collectionId),
        eq(collectionCards.cardId, cardId),
      ),
    );

  await refreshCollectionCoverAfterRemoval(collectionId, cardId, locale);

  await db
    .update(collections)
    .set({ updatedAt: new Date() })
    .where(eq(collections.id, collectionId));

  return { ok: true as const };
}

export async function getCollectionsForSet(setId: string) {
  return db.query.collections.findMany({
    where: and(eq(collections.setId, setId), eq(collections.type, "set")),
    orderBy: [desc(collections.createdAt)],
  });
}

export async function getSetCollectionCount(setId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collections)
    .where(and(eq(collections.setId, setId), eq(collections.type, "set")));

  return Number(row?.count ?? 0);
}

export async function getCollectionWithCards(
  collectionId: string,
  locale: UiLocale,
) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return null;
  }

  if (collection.type === "set" && !collection.setId) {
    return null;
  }

  const set =
    collection.type === "set" && collection.setId
      ? await db.query.sets.findFirst({
          where: eq(sets.id, collection.setId),
        })
      : null;

  if (collection.type === "set" && !set) {
    return null;
  }

  const preference = await getPricePreference();
  const cardNameSql = localizedCardNameSql(locale);
  const setNameSql = localizedSetNameSql(locale);

  const [checklistCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionCards)
    .where(eq(collectionCards.collectionId, collectionId));

  if (Number(checklistCountRow?.count ?? 0) === 0) {
    const progress = await getCollectionProgress(collection);

    return {
      collection: mapCollectionDetail(collection, locale, set ?? undefined),
      cards: [] as CollectionCardItem[],
      progress: {
        ownedCards: progress.ownedCount,
        totalCards: progress.totalCount,
        percent: progress.percent,
      },
      collectionEntryCount: await getCollectionEntryCount(collectionId),
      set: set
        ? {
            id: set.id,
            name: getLocalizedString(set.names, locale) ?? UNKNOWN_LABEL,
            officialCode: set.officialCode,
            cardsSyncedAt: set.cardsSyncedAt?.toISOString() ?? null,
            cardCountTotal: set.cardCountTotal,
            cardCountOfficial: set.cardCountOfficial,
          }
        : null,
    };
  }

  const cardRowsQuery = db
    .select({
      id: cards.id,
      number: cards.number,
      name: cardNameSql,
      rarity: cards.rarity,
      imageUrl: cards.imageUrl,
      setId: cards.setId,
      setName: setNameSql,
      officialCode: sets.officialCode,
      illustrator: cards.illustrator,
      variantId: cardVariants.id,
      variantType: cardVariants.variantType,
      cardmarketProductId: cardVariants.cardmarketProductId,
      ownedQuantity: sql<number>`coalesce(sum(case when ${userCards.collectionId} = ${collectionId} then ${userCards.quantity} else 0 end), 0)::int`,
      flagged: sql<boolean>`coalesce(bool_or(case when ${userCards.collectionId} = ${collectionId} then ${userCards.flagged} else false end), false)`,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
    })
    .from(collectionCards)
    .innerJoin(cards, eq(collectionCards.cardId, cards.id))
    .innerJoin(sets, eq(cards.setId, sets.id))
    .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
    .leftJoin(
      userCards,
      and(
        eq(userCards.variantId, cardVariants.id),
        eq(userCards.collectionId, collectionId),
      ),
    )
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(eq(collectionCards.collectionId, collectionId))
    .groupBy(
      cards.id,
      cards.number,
      cards.names,
      cards.rarity,
      cards.imageUrl,
      cards.setId,
      cards.illustrator,
      sets.names,
      sets.officialCode,
      cardVariants.id,
      cardVariants.variantType,
      cardVariants.cardmarketProductId,
      cardPrices.trendEur,
      cardPrices.lowEur,
    );

  const cardRows =
    collection.type === "set" && collection.setId
      ? await cardRowsQuery.orderBy(
          sql`case when ${cards.setId} = ${collection.setId} then 0 else 1 end`,
          asc(setNameSql),
          sql`lpad(${cards.number}, 4, '0')`,
          cardVariants.variantType,
        )
      : await cardRowsQuery.orderBy(
          asc(cardNameSql),
          cardVariants.variantType,
        );
  const cardsList = groupVariantRows(cardRows, preference);
  const progress = await getCollectionProgress(collection);

  return {
    collection: mapCollectionDetail(collection, locale, set ?? undefined),
    cards: cardsList,
    progress: {
      ownedCards: progress.ownedCount,
      totalCards: progress.totalCount,
      percent: progress.percent,
    },
    collectionEntryCount: await getCollectionEntryCount(collectionId),
    set: set
      ? {
          id: set.id,
          name: getLocalizedString(set.names, locale) ?? UNKNOWN_LABEL,
          officialCode: set.officialCode,
          cardsSyncedAt: set.cardsSyncedAt?.toISOString() ?? null,
          cardCountTotal: set.cardCountTotal,
          cardCountOfficial: set.cardCountOfficial,
        }
      : null,
  };
}

type CollectionCardItem = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  imageUrl: string | null;
  setId: string;
  setName: string;
  officialCode: string | null;
  illustrator: string | null;
  owned: boolean;
  ownedQuantity: number;
  flagged: boolean;
  variants: Array<{
    id: string;
    variantType: string;
    ownedQuantity: number;
    price: number | null;
    cardmarketProductId: number | null;
  }>;
};

function groupVariantRows(
  rows: Array<{
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    imageUrl: string | null;
    setId: string;
    setName: string;
    officialCode: string | null;
    illustrator: string | null;
    variantId: string;
    variantType: string;
    cardmarketProductId: number | null;
    ownedQuantity: number;
    flagged: boolean;
    trendEur: string | null;
    lowEur: string | null;
  }>,
  preference: Awaited<ReturnType<typeof getPricePreference>>,
): CollectionCardItem[] {
  const grouped = new Map<string, CollectionCardItem>();

  for (const row of rows) {
    const existing = grouped.get(row.id) ?? {
      id: row.id,
      number: row.number,
      name: row.name,
      rarity: row.rarity,
      imageUrl: row.imageUrl,
      setId: row.setId,
      setName: row.setName,
      officialCode: row.officialCode,
      illustrator: row.illustrator,
      owned: false,
      ownedQuantity: 0,
      flagged: false,
      variants: [],
    };

    const ownedQuantity = Number(row.ownedQuantity);
    existing.ownedQuantity += ownedQuantity;
    existing.owned = existing.owned || ownedQuantity > 0;
    existing.flagged = existing.flagged || Boolean(row.flagged);
    existing.variants.push(
      buildCardVariantEntry(row, preference, ownedQuantity),
    );
    grouped.set(row.id, existing);
  }

  return Array.from(grouped.values());
}

function mapCollectionDetail(
  collection: CollectionRow,
  locale: UiLocale,
  set?: typeof sets.$inferSelect,
) {
  return {
    id: collection.id,
    name: collection.name,
    imageUrl: collection.imageUrl,
    ...getCollectionCoverFields(collection),
    type: collection.type,
    setId: collection.setId,
    setName: set
      ? (getLocalizedString(set.names, locale) ?? UNKNOWN_LABEL)
      : null,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

export async function getCardWithVariantsForCollection(
  cardId: string,
  collectionId: string,
  locale: UiLocale,
) {
  const preference = await getPricePreference();
  const cardNameSql = localizedCardNameSql(locale);
  const setNameSql = localizedSetNameSql(locale);

  const rows = await db
    .select({
      id: cards.id,
      number: cards.number,
      name: cardNameSql,
      imageUrl: cards.imageUrl,
      setId: sets.id,
      setName: setNameSql,
      officialCode: sets.officialCode,
      variantId: cardVariants.id,
      variantType: cardVariants.variantType,
      cardmarketProductId: cardVariants.cardmarketProductId,
      ownedQuantity: sql<number>`coalesce(sum(case when ${userCards.collectionId} = ${collectionId} then ${userCards.quantity} else 0 end), 0)::int`,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
    })
    .from(cards)
    .innerJoin(sets, eq(cards.setId, sets.id))
    .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
    .leftJoin(
      userCards,
      and(
        eq(userCards.variantId, cardVariants.id),
        eq(userCards.collectionId, collectionId),
      ),
    )
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(eq(cards.id, cardId))
    .groupBy(
      cards.id,
      cards.number,
      cards.names,
      cards.imageUrl,
      sets.id,
      sets.names,
      sets.officialCode,
      cardVariants.id,
      cardVariants.variantType,
      cardVariants.cardmarketProductId,
      cardPrices.trendEur,
      cardPrices.lowEur,
    )
    .orderBy(cardVariants.variantType);

  if (rows.length === 0) {
    return null;
  }

  const first = rows[0]!;
  const variants = rows.map((row) =>
    buildCardVariantEntry(row, preference, Number(row.ownedQuantity)),
  );

  return {
    id: first.id,
    number: first.number,
    name: first.name,
    imageUrl: first.imageUrl,
    setId: first.setId,
    setName: first.setName,
    officialCode: first.officialCode,
    variants,
    collectionId,
  };
}

export async function getCollectionEntriesForCard(
  collectionId: string,
  cardId: string,
  locale: UiLocale,
) {
  const cardNameSql = localizedCardNameSql(locale);
  const setNameSql = localizedSetNameSql(locale);
  const preference = await getPricePreference();

  const rows = await db
    .select({
      id: userCards.id,
      quantity: userCards.quantity,
      condition: userCards.condition,
      language: userCards.language,
      notes: userCards.notes,
      purchasePrice: userCards.purchasePrice,
      flagged: userCards.flagged,
      variantId: cardVariants.id,
      variantType: cardVariants.variantType,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
    })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .innerJoin(sets, eq(cards.setId, sets.id))
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(
      and(
        eq(userCards.collectionId, collectionId),
        eq(cards.id, cardId),
      ),
    )
    .orderBy(desc(userCards.updatedAt));

  return rows.map((row) => {
    const price = pickPrice(row, preference);
    return {
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      notes: row.notes,
      purchasePrice: row.purchasePrice,
      flagged: row.flagged,
      variantId: row.variantId,
      variantType: row.variantType,
      price,
      value: price != null ? price * row.quantity : null,
    };
  });
}
