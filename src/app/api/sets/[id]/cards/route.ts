import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/lib/i18n/server";
import { clearSetCardData } from "@/lib/set-cards";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { t } = getRequestTranslator(request);
  try {
    const { id } = await context.params;
    const result = await clearSetCardData(id);

    if (!result) {
      return NextResponse.json({ error: t("errors.api.setNotFound") }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("errors.api.setCardDataDeleteFailed") },
      { status: 500 },
    );
  }
}
