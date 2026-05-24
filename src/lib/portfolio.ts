import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardPrices,
  cards,
  cardVariants,
  sets,
  syncJobs,
  userCards,
} from "@/db/schema";
import { cardDisplayNameSql } from "@/lib/card-names";
import { getPricePreference, pickPrice } from "@/lib/settings";

export async function getPortfolioSummary() {
  const preference = await getPricePreference();

  const collectionRows = await db
    .select({
      quantity: userCards.quantity,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
      cardName: cardDisplayNameSql,
      setName: sets.nameDe,
      updatedAt: userCards.updatedAt,
    })
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .innerJoin(sets, eq(cards.setId, sets.id))
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id));

  let totalValue = 0;
  let cardsWithPrice = 0;
  let totalCards = 0;

  for (const row of collectionRows) {
    totalCards += row.quantity;
    const unit = pickPrice(row, preference);
    if (unit != null) {
      totalValue += unit * row.quantity;
      cardsWithPrice += row.quantity;
    }
  }

  const setProgress = await db.execute<{
    set_id: string;
    set_name: string;
    owned: number;
    total: number;
  }>(sql`
    SELECT
      s.id AS set_id,
      s.name_de AS set_name,
      COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN c.id END)::int AS owned,
      COUNT(DISTINCT c.id)::int AS total
    FROM sets s
    INNER JOIN cards c ON c.set_id = s.id
    INNER JOIN card_variants cv ON cv.card_id = c.id
    LEFT JOIN user_cards uc ON uc.variant_id = cv.id
    GROUP BY s.id, s.name_de, s.release_date
    ORDER BY s.release_date DESC NULLS LAST
  `);

  const recentRows = await db.execute<{
    id: string;
    card_id: string;
    card_name: string;
    set_id: string;
    set_name: string;
    set_code: string | null;
    number: string;
    image_url: string | null;
    quantity: number;
    updated_at: Date;
  }>(sql`
    SELECT *
    FROM (
      SELECT DISTINCT ON (c.id)
        uc.id,
        c.id AS card_id,
        coalesce(c.name_de, c.name_en, 'Unbekannt') AS card_name,
        s.id AS set_id,
        s.name_de AS set_name,
        s.official_code AS set_code,
        c.number,
        c.image_url,
        uc.quantity,
        uc.updated_at
      FROM user_cards uc
      INNER JOIN card_variants cv ON uc.variant_id = cv.id
      INNER JOIN cards c ON cv.card_id = c.id
      INNER JOIN sets s ON c.set_id = s.id
      ORDER BY c.id, uc.updated_at DESC
    ) recent_cards
    ORDER BY updated_at DESC
    LIMIT 8
  `);

  const recent = recentRows.map((row) => ({
    id: row.id,
    cardId: row.card_id,
    cardName: row.card_name,
    setId: row.set_id,
    setName: row.set_name,
    officialCode: row.set_code,
    number: row.number,
    imageUrl: row.image_url,
    quantity: Number(row.quantity),
    updatedAt: row.updated_at,
  }));

  const latestCatalogSync = await db.query.syncJobs.findFirst({
    where: eq(syncJobs.jobType, "catalog"),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const latestPriceSync = await db.query.syncJobs.findFirst({
    where: eq(syncJobs.jobType, "prices"),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return {
    totalValue,
    totalCards,
    cardsWithPrice,
    uniqueEntries: collectionRows.length,
    setProgress: setProgress.map((row) => ({
      setId: row.set_id,
      setName: row.set_name,
      owned: Number(row.owned),
      total: Number(row.total),
      percent:
        Number(row.total) > 0
          ? Math.round((Number(row.owned) / Number(row.total)) * 100)
          : 0,
    })),
    recent,
    sync: {
      catalog: latestCatalogSync ?? null,
      prices: latestPriceSync ?? null,
    },
    pricePreference: preference,
  };
}

export async function getSetWithCards(setId: string) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });
  if (!set) return null;

  const preference = await getPricePreference();

  const setCards = await db
    .select({
      id: cards.id,
      number: cards.number,
      nameDe: cardDisplayNameSql,
      rarity: cards.rarity,
      imageUrl: cards.imageUrl,
      variantId: cardVariants.id,
      variantType: cardVariants.variantType,
      cardmarketProductId: cardVariants.cardmarketProductId,
      ownedQuantity: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int`,
      flagged: sql<boolean>`coalesce(bool_or(${userCards.flagged}), false)`,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
    })
    .from(cards)
    .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
    .leftJoin(userCards, eq(userCards.variantId, cardVariants.id))
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(eq(cards.setId, setId))
    .groupBy(
      cards.id,
      cards.number,
      cards.nameDe,
      cards.nameEn,
      cards.rarity,
      cards.imageUrl,
      cardVariants.id,
      cardVariants.variantType,
      cardVariants.cardmarketProductId,
      cardPrices.trendEur,
      cardPrices.lowEur,
    )
    .orderBy(sql`lpad(${cards.number}, 4, '0')`, cardVariants.variantType);

  const grouped = new Map<
    string,
    {
      id: string;
      number: string;
      nameDe: string;
      rarity: string | null;
      imageUrl: string | null;
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
    }
  >();

  for (const row of setCards) {
    const existing = grouped.get(row.id) ?? {
      id: row.id,
      number: row.number,
      nameDe: row.nameDe,
      rarity: row.rarity,
      imageUrl: row.imageUrl,
      owned: false,
      ownedQuantity: 0,
      flagged: false,
      variants: [],
    };

    const ownedQuantity = Number(row.ownedQuantity);
    existing.ownedQuantity += ownedQuantity;
    existing.owned = existing.owned || ownedQuantity > 0;
    existing.flagged = existing.flagged || Boolean(row.flagged);
    existing.variants.push({
      id: row.variantId,
      variantType: row.variantType,
      ownedQuantity,
      price: pickPrice(row, preference),
      cardmarketProductId: row.cardmarketProductId,
    });
    grouped.set(row.id, existing);
  }

  const cardsList = Array.from(grouped.values());
  const ownedCards = cardsList.filter((card) => card.owned).length;
  const totalCards = cardsList.length;

  return {
    set,
    cards: cardsList,
    progress: {
      ownedCards,
      totalCards,
      percent:
        totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0,
    },
  };
}
