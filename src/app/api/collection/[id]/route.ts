import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { userCards } from "@/db/schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await db.query.userCards.findFirst({
      where: eq(userCards.id, id),
    });
    if (!existing) {
      return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
    }

    const [updated] = await db
      .update(userCards)
      .set({
        quantity: body.quantity ?? existing.quantity,
        condition: body.condition ?? existing.condition,
        language: body.language ?? existing.language,
        notes: body.notes ?? existing.notes,
        purchasePrice:
          body.purchasePrice != null
            ? body.purchasePrice.toString()
            : existing.purchasePrice,
        flagged: body.flagged ?? existing.flagged,
        updatedAt: new Date(),
      })
      .where(eq(userCards.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await db.delete(userCards).where(eq(userCards.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
