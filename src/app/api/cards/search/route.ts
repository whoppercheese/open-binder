import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { cardPrices, cards, cardVariants, sets, userCards } from "@/db/schema";
import { getPricePreference, pickPrice } from "@/lib/settings";
import { buildSearchSql, parseSearchQuery } from "@/lib/search";
import { cardDisplayNameSql } from "@/lib/card-names";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const parsed = parseSearchQuery(q);
    const idRows = await db.execute<{ id: string }>(buildSearchSql(parsed));
    const cardIds = idRows.map((row) => row.id);
    if (cardIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const preference = await getPricePreference();

    const results = await db
      .select({
        id: cards.id,
        number: cards.number,
        nameDe: cardDisplayNameSql,
        rarity: cards.rarity,
        imageUrl: cards.imageUrl,
        setId: sets.id,
        setName: sets.nameDe,
        officialCode: sets.officialCode,
        variantId: cardVariants.id,
        variantType: cardVariants.variantType,
        cardmarketProductId: cardVariants.cardmarketProductId,
        ownedQuantity: userCards.quantity,
        trendEur: cardPrices.trendEur,
        lowEur: cardPrices.lowEur,
      })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
      .leftJoin(userCards, eq(userCards.variantId, cardVariants.id))
      .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
      .where(inArray(cards.id, cardIds))
      .orderBy(cardDisplayNameSql);

    const grouped = new Map<
      string,
      {
        id: string;
        number: string;
        nameDe: string;
        rarity: string | null;
        imageUrl: string | null;
        setId: string;
        setName: string;
        officialCode: string | null;
        owned: boolean;
        variants: Array<{
          id: string;
          variantType: string;
          ownedQuantity: number | null;
          price: number | null;
          cardmarketProductId: number | null;
        }>;
      }
    >();

    for (const row of results) {
      const existing = grouped.get(row.id) ?? {
        id: row.id,
        number: row.number,
        nameDe: row.nameDe,
        rarity: row.rarity,
        imageUrl: row.imageUrl,
        setId: row.setId,
        setName: row.setName,
        officialCode: row.officialCode,
        owned: false,
        variants: [],
      };

      const ownedQuantity = row.ownedQuantity ?? 0;
      existing.owned = existing.owned || ownedQuantity > 0;
      existing.variants.push({
        id: row.variantId,
        variantType: row.variantType,
        ownedQuantity: row.ownedQuantity,
        price: pickPrice(row, preference),
        cardmarketProductId: row.cardmarketProductId,
      });
      grouped.set(row.id, existing);
    }

    return NextResponse.json({ results: Array.from(grouped.values()) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Suche fehlgeschlagen." },
      { status: 500 },
    );
  }
}
