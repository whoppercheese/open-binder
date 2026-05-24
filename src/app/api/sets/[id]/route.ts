import { NextResponse } from "next/server";
import { getSetWithCards } from "@/lib/portfolio";
import { getRequestTranslator } from "@/lib/i18n/server";
import { ensureSetMetadata } from "@/lib/set-metadata.server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    let data = await getSetWithCards(id, locale);

    if (!data) {
      const ensured = await ensureSetMetadata(id);
      if (ensured) {
        data = await getSetWithCards(id, locale);
      }
    }

    if (!data) {
      return NextResponse.json({ errorCode: "SET_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SET_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
