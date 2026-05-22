import { NextResponse } from "next/server";
import { getSetWithCards } from "@/lib/portfolio";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const data = await getSetWithCards(id);
    if (!data) {
      return NextResponse.json({ error: "Set nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Set konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
