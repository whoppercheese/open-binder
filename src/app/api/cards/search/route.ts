import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { cardPrices, cards, cardVariants, sets, userCards } from "@/db/schema";
import {
  localizedCardNameSql,
  localizedSetNameSql,
} from "@/lib/localized-names";
import { getRequestTranslator } from "@/lib/i18n/server";
import { getPricePreference, pickPrice } from "@/lib/settings";
import { buildSearchSql, parseSearchQuery } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const parsed = parseSearchQuery(q);
    const idRows = await db.execute<{ id: string }>(
      buildSearchSql(parsed, locale),
    );
    const cardIds = idRows.map((row) => row.id);
    if (cardIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const preference = await getPricePreference();
    const nameSql = localizedCardNameSql(locale);
    const setNameSql = localizedSetNameSql(locale);

    const results = await db
      .select({
        id: cards.id,
        number: cards.number,
        name: nameSql,
        rarity: cards.rarity,
        imageUrl: cards.imageUrl,
        setId: sets.id,
        setName: setNameSql,
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
      .orderBy(nameSql);

    const grouped = new Map<
      string,
      {
        id: string;
        number: string;
        name: string;
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
        name: row.name,
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
      { errorCode: "SEARCH_FAILED" },
      { status: 500 },
    );
  }
}
