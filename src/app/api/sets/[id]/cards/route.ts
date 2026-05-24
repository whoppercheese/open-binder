import { NextResponse } from "next/server";
import { clearSetCardData } from "@/lib/set-cards";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await clearSetCardData(id);

    if (!result) {
      return NextResponse.json({ error: "Set nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Kartendaten konnten nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
