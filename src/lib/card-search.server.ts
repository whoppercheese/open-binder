import "server-only";

import { db } from "@/db/client";
import { loadCardSearchResults } from "@/lib/card-search-results.server";
import { searchCatalogCards } from "@/lib/catalog-card-search";
import type { UiLocale } from "@/lib/i18n/locale";
import { buildSearchSql, parseSearchQuery } from "@/lib/search";

export const SEARCH_PAGE_SIZE = 24;

export type CardSearchPage = {
  results: Awaited<ReturnType<typeof loadCardSearchResults>>;
  hasMore: boolean;
  total?: number;
};

function parsePageOptions(searchParams: URLSearchParams) {
  const limit =
    Number.parseInt(searchParams.get("limit") ?? "", 10) || SEARCH_PAGE_SIZE;
  const offset = Number.parseInt(searchParams.get("offset") ?? "", 10) || 0;

  return {
    limit: Math.min(Math.max(limit, 1), 100),
    offset: Math.max(offset, 0),
  };
}

export async function searchCards(
  raw: string,
  locale: UiLocale,
  searchParams: URLSearchParams,
): Promise<CardSearchPage> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { results: [], hasMore: false, total: 0 };
  }

  const { limit, offset } = parsePageOptions(searchParams);
  const scope = searchParams.get("scope");

  if (scope === "all") {
    return searchCatalogCards(trimmed, locale, { offset, limit });
  }

  const parsed = parseSearchQuery(trimmed);
  const idRows = await db.execute<{ id: string }>(
    buildSearchSql(parsed, locale, limit + 1, offset),
  );
  const hasMore = idRows.length > limit;
  const cardIds = idRows.slice(0, limit).map((row) => row.id);
  const results = await loadCardSearchResults(cardIds, locale);

  return { results, hasMore };
}
