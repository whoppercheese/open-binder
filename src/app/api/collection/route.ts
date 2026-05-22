import { desc, eq } from "drizzle-orm";
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

export async function GET() {
  try {
    const preference = await getPricePreference();
    const rows = await db
      .select({
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
        nameDe: cards.nameDe,
        imageUrl: cards.imageUrl,
        setId: sets.id,
        setName: sets.nameDe,
        trendEur: cardPrices.trendEur,
        lowEur: cardPrices.lowEur,
      })
      .from(userCards)
      .innerJoin(cardVariants, eq(userCards.variantId, cardVariants.id))
      .innerJoin(cards, eq(cardVariants.cardId, cards.id))
      .innerJoin(sets, eq(cards.setId, sets.id))
      .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
      .orderBy(desc(userCards.updatedAt));

    const items = rows.map((row) => ({
      ...row,
      price: pickPrice(row, preference),
      value:
        pickPrice(row, preference) != null
          ? pickPrice(row, preference)! * row.quantity
          : null,
    }));

    return NextResponse.json({ items });
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

    const [entry] = await db
      .insert(userCards)
      .values({
        variantId,
        quantity,
        condition,
        language,
        notes,
        purchasePrice:
          purchasePrice != null ? purchasePrice.toString() : null,
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
