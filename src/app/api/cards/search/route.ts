import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { loadCardSearchResults } from "@/lib/card-search-results.server";
import { searchCatalogCards } from "@/lib/catalog-card-search";
import { getRequestTranslator } from "@/lib/i18n/server";
import { buildSearchSql, parseSearchQuery } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const scope = searchParams.get("scope");
    if (scope === "all") {
      const results = await searchCatalogCards(q, locale);
      return NextResponse.json({ results });
    }

    const parsed = parseSearchQuery(q);
    const idRows = await db.execute<{ id: string }>(
      buildSearchSql(parsed, locale),
    );
    const cardIds = idRows.map((row) => row.id);
    const results = await loadCardSearchResults(cardIds, locale);

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SEARCH_FAILED" },
      { status: 500 },
    );
  }
}
