import "server-only";

import type { UiLocale } from "@/lib/i18n/locale";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getTcgdexClient } from "@/lib/tcgdex-client";
import {
  listAllSetSummaries,
  type TcgdexSetSummary,
} from "@/lib/tcgdex";
import type { SetSummary } from "@/lib/sets-list";

export type CatalogSetEntry = SetSummary;

const CACHE_TTL_MS = 60 * 60 * 1000;
const SET_FETCH_CONCURRENCY = 12;

const indexCache = new Map<
  UiLocale,
  { fetchedAt: number; entries: CatalogSetEntry[] }
>();

async function buildCatalogSetIndex(locale: UiLocale): Promise<CatalogSetEntry[]> {
  const summaries = await listAllSetSummaries(locale);
  const client = getTcgdexClient(locale);

  return mapWithConcurrency(summaries, SET_FETCH_CONCURRENCY, async (summary) => {
    const detail = (await client.set.get(summary.id)) as TcgdexSetSummary | null;
    return {
      id: summary.id,
      name: detail?.name ?? summary.name,
      officialCode: detail?.abbreviation?.official ?? null,
    };
  });
}

export async function getCatalogSetIndex(
  locale: UiLocale,
): Promise<CatalogSetEntry[]> {
  const cached = indexCache.get(locale);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const entries = await buildCatalogSetIndex(locale);
  indexCache.set(locale, { fetchedAt: Date.now(), entries });
  return entries;
}

export function matchCatalogSetIds(
  token: string,
  entries: readonly CatalogSetEntry[],
): string[] {
  const lowerToken = token.toLowerCase();
  return entries
    .filter(
      (entry) =>
        entry.name.toLowerCase().includes(lowerToken) ||
        entry.id.toLowerCase().includes(lowerToken) ||
        (entry.officialCode?.toLowerCase() ?? "") === lowerToken,
    )
    .map((entry) => entry.id);
}

export function matchCatalogSetIdsForBulkFetch(
  token: string,
  entries: readonly CatalogSetEntry[],
): string[] {
  const lowerToken = token.toLowerCase();
  return entries
    .filter(
      (entry) =>
        entry.name.toLowerCase() === lowerToken ||
        entry.id.toLowerCase() === lowerToken ||
        (entry.officialCode?.toLowerCase() ?? "") === lowerToken,
    )
    .map((entry) => entry.id);
}

export function getCatalogSetMetadata(
  entries: readonly CatalogSetEntry[],
): Map<string, { name: string; officialCode: string | null }> {
  return new Map(
    entries.map((entry) => [
      entry.id,
      { name: entry.name, officialCode: entry.officialCode },
    ]),
  );
}
