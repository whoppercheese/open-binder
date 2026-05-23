import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  cardPrices,
  cards,
  cardVariants,
  sets,
  userCards,
} from "@/db/schema";
import { getPricePreference, pickPrice } from "@/lib/settings";
import { cardDisplayNameSql } from "@/lib/card-names";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const collectionSelect = {
  id: userCards.id,
  quantity: userCards.quantity,
  condition: userCards.condition,
  language: userCards.language,
  notes: userCards.notes,
  purchasePrice: userCards.purchasePrice,
  updatedAt: userCards.updatedAt,
  variantId: cardVariants.id,
  variantType: cardVariants.variantType,
  cardId: cards.id,
  number: cards.number,
  nameDe: cardDisplayNameSql,
  imageUrl: cards.imageUrl,
  setId: sets.id,
  setName: sets.nameDe,
  trendEur: cardPrices.trendEur,
  lowEur: cardPrices.lowEur,
};

function collectionFrom() {
  return db
    .select(collectionSelect)
    .from(userCards)
    .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
    .innerJoin(cards, eq(cardVariants.cardId, cards.id))
    .innerJoin(sets, eq(cards.setId, sets.id))
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id));
}

function buildSearchFilter(query: string): SQL | undefined {
  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  const pattern = `%${trimmed}%`;
  return or(
    ilike(cards.nameDe, pattern),
    ilike(cards.nameEn, pattern),
    ilike(cards.number, pattern),
    ilike(sets.nameDe, pattern),
    ilike(sets.officialCode, pattern),
  );
}

function buildWhereClause(query: string, cardId: string): SQL | undefined {
  const filters = [
    buildSearchFilter(query),
    cardId.trim() ? eq(cards.id, cardId.trim()) : undefined,
  ].filter((filter): filter is SQL => filter != null);

  if (filters.length === 0) {
    return undefined;
  }

  return filters.length === 1 ? filters[0] : and(...filters);
}

function mapCollectionRow(
  row: Awaited<ReturnType<typeof collectionFrom>>[number],
  preference: Awaited<ReturnType<typeof getPricePreference>>,
) {
  const price = pickPrice(row, preference);
  return {
    ...row,
    price,
    value: price != null ? price * row.quantity : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(
      Number.parseInt(searchParams.get("offset") ?? "", 10) || 0,
      0,
    );
    const query = searchParams.get("q")?.trim() ?? "";
    const cardId = searchParams.get("cardId")?.trim() ?? "";
    const whereClause = buildWhereClause(query, cardId);

    const preference = await getPricePreference();

    let total = 0;
    let totalValue = 0;
    if (offset === 0) {
      const statsRows = await db
        .select({
          quantity: userCards.quantity,
          trendEur: cardPrices.trendEur,
          lowEur: cardPrices.lowEur,
        })
        .from(userCards)
        .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
        .innerJoin(cards, eq(cardVariants.cardId, cards.id))
        .innerJoin(sets, eq(cards.setId, sets.id))
        .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
        .where(whereClause);

      total = statsRows.length;
      totalValue = statsRows.reduce((sum, row) => {
        const price = pickPrice(row, preference);
        return sum + (price != null ? price * row.quantity : 0);
      }, 0);
    }

    const rows = await collectionFrom()
      .where(whereClause)
      .orderBy(
        asc(sets.nameDe),
        sql`lpad(${cards.number}, 4, '0')`,
        desc(userCards.updatedAt),
      )
      .limit(limit)
      .offset(offset);

    const items = rows.map((row) => mapCollectionRow(row, preference));
    const loadedCount = offset + items.length;
    const hasMore =
      offset === 0 ? loadedCount < total : items.length === limit;

    return NextResponse.json({
      items,
      total: offset === 0 ? total : undefined,
      totalValue: offset === 0 ? totalValue : undefined,
      hasMore,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Sammlung konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      variantId,
      quantity = 1,
      condition = "nm",
      language = "de",
      notes = null,
      purchasePrice = null,
    } = body;

    if (!variantId) {
      return NextResponse.json(
        { error: "variantId ist erforderlich." },
        { status: 400 },
      );
    }

    const variant = await db.query.cardVariants.findFirst({
      where: eq(cardVariants.id, variantId),
    });
    if (!variant) {
      return NextResponse.json(
        { error: "Variante nicht gefunden." },
        { status: 404 },
      );
    }

    const normalizedNotes = notes || null;
    const normalizedPurchasePrice =
      purchasePrice != null ? purchasePrice.toString() : null;

    const existing = await db.query.userCards.findFirst({
      where: and(
        eq(userCards.variantId, variantId),
        eq(userCards.condition, condition),
        eq(userCards.language, language),
        normalizedNotes != null
          ? eq(userCards.notes, normalizedNotes)
          : isNull(userCards.notes),
        normalizedPurchasePrice != null
          ? eq(userCards.purchasePrice, normalizedPurchasePrice)
          : isNull(userCards.purchasePrice),
      ),
    });

    if (existing) {
      const [entry] = await db
        .update(userCards)
        .set({
          quantity: Math.min(existing.quantity + quantity, 999),
          updatedAt: new Date(),
        })
        .where(eq(userCards.id, existing.id))
        .returning();

      return NextResponse.json({ item: entry });
    }

    const [entry] = await db
      .insert(userCards)
      .values({
        variantId,
        quantity,
        condition,
        language,
        notes: normalizedNotes,
        purchasePrice: normalizedPurchasePrice,
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ item: entry }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Karte konnte nicht hinzugefügt werden." },
      { status: 500 },
    );
  }
}
