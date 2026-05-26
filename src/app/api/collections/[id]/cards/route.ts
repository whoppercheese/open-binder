import { NextResponse } from "next/server";
import {
  addCardToCollectionChecklist,
  getCollectionWithCards,
  removeCardFromCollectionChecklist,
} from "@/lib/collections.server";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    const data = await getCollectionWithCards(id, locale);

    if (!data) {
      return NextResponse.json(
        { errorCode: "COLLECTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_CARDS_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { cardId } = body;

    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json(
        { errorCode: "CARD_ID_REQUIRED" },
        { status: 400 },
      );
    }

    const result = await addCardToCollectionChecklist(id, cardId);

    if ("error" in result) {
      const status =
        result.error === "COLLECTION_NOT_FOUND" ||
        result.error === "CARD_NOT_FOUND"
          ? 404
          : 400;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_CARD_ADD_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId")?.trim();

    if (!cardId) {
      return NextResponse.json(
        { errorCode: "CARD_ID_REQUIRED" },
        { status: 400 },
      );
    }

    const result = await removeCardFromCollectionChecklist(id, cardId, locale);

    if ("error" in result) {
      const status = result.error === "COLLECTION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_CARD_REMOVE_FAILED" },
      { status: 500 },
    );
  }
}
