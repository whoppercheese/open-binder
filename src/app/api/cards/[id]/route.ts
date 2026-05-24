import { NextResponse } from "next/server";
import { getCardWithVariants } from "@/lib/portfolio";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const card = await getCardWithVariants(id);
    if (!card) {
      return NextResponse.json({ error: "Karte nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json(card);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Karte konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
