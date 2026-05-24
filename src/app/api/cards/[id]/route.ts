import { NextResponse } from "next/server";
import { getCardWithVariants } from "@/lib/portfolio";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    const card = await getCardWithVariants(id, locale);
    if (!card) {
      return NextResponse.json({ errorCode: "CARD_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(card);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "CARD_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
