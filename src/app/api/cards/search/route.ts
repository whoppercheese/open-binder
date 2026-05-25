import { NextResponse } from "next/server";
import { searchCards } from "@/lib/card-search.server";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ results: [], hasMore: false, total: 0 });
    }

    const payload = await searchCards(q, locale, searchParams);
    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SEARCH_FAILED" },
      { status: 500 },
    );
  }
}
