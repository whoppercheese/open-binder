import "server-only";

import TCGdex, { Query } from "@tcgdex/sdk";
import type { UiLocale } from "@/lib/i18n/locale";
import { type TcgdexSetSummary } from "@/lib/tcgdex";

export type CatalogSetEntry = {
  id: string;
  name: string;
  officialCode: string | null;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const SET_FETCH_CONCURRENCY = 12;

const clients = new Map<UiLocale, TCGdex>();
const indexCache = new Map<
  UiLocale,
  { fetchedAt: number; entries: CatalogSetEntry[] }
>();

function getCatalogClient(locale: UiLocale): TCGdex {
  let client = clients.get(locale);
  if (!client) {
    client = new TCGdex(locale);
    client.setCacheTTL(0);
    clients.set(locale, client);
  }
  return client;
}

async function listAllSetSummaries(locale: UiLocale) {
  const client = getCatalogClient(locale);
  const summaries: Array<{ id: string; name: string }> = [];

  for (let page = 1; page <= 10; page += 1) {
    const batch = await client.set.list(
      Query.create().paginate(page, 100),
    );
    if (!batch?.length) {
      break;
    }
    summaries.push(...batch.map((set) => ({ id: set.id, name: set.name })));
    if (batch.length < 100) {
      break;
    }
  }

  return summaries;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function buildCatalogSetIndex(locale: UiLocale): Promise<CatalogSetEntry[]> {
  const summaries = await listAllSetSummaries(locale);
  const client = getCatalogClient(locale);

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
