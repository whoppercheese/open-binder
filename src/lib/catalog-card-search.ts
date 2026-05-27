import "server-only";

import { db } from "@/db/client";
import { cards, sets } from "@/db/schema";
import { extractSetIdFromCardId } from "@/lib/card-id";
import { loadCardSearchResults } from "@/lib/card-search-results.server";
import {
  getCatalogSetIndex,
  getCatalogSetMetadata,
  matchCatalogSetIds,
  matchCatalogSetIdsForBulkFetch,
} from "@/lib/catalog-set-index.server";
import type { UiLocale } from "@/lib/i18n/locale";
import type { CardSearchFields, ParsedSearchQuery } from "@/lib/search";
import {
  cardMatchesCatalogSearchQuery,
  isNumberToken,
  numbersMatch,
  parseSearchQuery,
  pickDiverseSearchResults,
  scoreCatalogSearchMatch,
} from "@/lib/search";
import {
  decodeTcgdexLocalId,
  resolveCardImageCandidates,
  resolveTcgdexAssetUrl,
  type TcgdexCard,
} from "@/lib/tcgdex";
import { getTcgdexClient } from "@/lib/tcgdex-client";
import { Query } from "@tcgdex/sdk";
import { inArray } from "drizzle-orm";

const CATALOG_SET_FETCH_LIMIT = 50;
const NUMBER_FETCH_PAGE_SIZE = 100;
const NUMBER_FETCH_MAX_PAGES = 3;
const NAME_FETCH_PAGE_SIZE = 100;
const NAME_FETCH_MAX_PAGES = 5;
const ILLUSTRATOR_FETCH_PAGE_SIZE = 100;
const ILLUSTRATOR_FETCH_MAX_PAGES = 5;
const CATALOG_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

type CatalogSearchCacheEntry = {
  fetchedAt: number;
  briefs: TcgdexCardBrief[];
};

const catalogSearchCache = new Map<string, CatalogSearchCacheEntry>();

type TcgdexCardBrief = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

type SetMetadata = {
  name: string;
  officialCode: string | null;
};

function mapCardBrief(card: {
  id: string;
  localId: string;
  name: string;
  image?: string;
}): TcgdexCardBrief {
  return {
    id: card.id,
    localId: card.localId,
    name: card.name,
    image: card.image,
  };
}

async function listCatalogCards(
  locale: UiLocale,
  query: Query,
): Promise<TcgdexCardBrief[]> {
  const cards = await getTcgdexClient(locale).card.list(query);
  return (cards ?? []).map(mapCardBrief);
}

function dedupeBriefs(briefs: TcgdexCardBrief[]): TcgdexCardBrief[] {
  const seen = new Set<string>();
  const result: TcgdexCardBrief[] = [];

  for (const brief of briefs) {
    if (seen.has(brief.id)) {
      continue;
    }
    seen.add(brief.id);
    result.push(brief);
  }

  return result;
}

function resolveBriefImageUrl(
  brief: TcgdexCardBrief,
  seriesIdBySetId: ReadonlyMap<string, string>,
  locale: UiLocale,
): string | null {
  const setId = extractSetIdFromCardId(brief.id);
  const seriesId = seriesIdBySetId.get(setId);
  const localId = decodeTcgdexLocalId(brief.localId);

  if (!seriesId) {
    return brief.image ? resolveTcgdexAssetUrl(brief.image) : null;
  }

  const stub: TcgdexCard = {
    id: brief.id,
    localId,
    name: brief.name,
    image: brief.image,
    set: { id: setId, name: "" },
  };

  return resolveCardImageCandidates(stub, seriesId, setId, locale)[0] ?? null;
}

async function loadSeriesIdsBySetId(
  locale: UiLocale,
  setIds: readonly string[],
): Promise<Map<string, string>> {
  const uniqueSetIds = [...new Set(setIds)];
  if (uniqueSetIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: sets.id, seriesId: sets.seriesId })
    .from(sets)
    .where(inArray(sets.id, uniqueSetIds));

  const seriesBySetId = new Map(rows.map((row) => [row.id, row.seriesId]));

  const missingSetIds = uniqueSetIds.filter(
    (setId) => !seriesBySetId.has(setId),
  );
  if (missingSetIds.length === 0) {
    return seriesBySetId;
  }

  const client = getTcgdexClient(locale);
  await Promise.all(
    missingSetIds.map(async (setId) => {
      const set = await client.set.get(setId);
      const seriesId = set?.serie?.id;
      if (seriesId) {
        seriesBySetId.set(setId, seriesId);
      }
    }),
  );

  return seriesBySetId;
}

async function fetchCardsByExactNumber(
  number: string,
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  const matches: TcgdexCardBrief[] = [];

  for (let page = 1; page <= NUMBER_FETCH_MAX_PAGES; page += 1) {
    const batch = await listCatalogCards(
      locale,
      Query.create()
        .contains("localId", number)
        .paginate(page, NUMBER_FETCH_PAGE_SIZE),
    );

    if (batch.length === 0) {
      break;
    }

    for (const brief of batch) {
      const cardNumber = decodeTcgdexLocalId(brief.localId);
      if (numbersMatch(cardNumber, number)) {
        matches.push(brief);
      }
    }

    if (batch.length < NUMBER_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return matches;
}

async function fetchCardsByNameToken(
  token: string,
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  const matches: TcgdexCardBrief[] = [];

  for (let page = 1; page <= NAME_FETCH_MAX_PAGES; page += 1) {
    const batch = await listCatalogCards(
      locale,
      Query.create()
        .contains("name", token)
        .paginate(page, NAME_FETCH_PAGE_SIZE),
    );

    if (batch.length === 0) {
      break;
    }

    matches.push(...batch);

    if (batch.length < NAME_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return matches;
}

async function fetchCardsByIllustratorToken(
  token: string,
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  const matches: TcgdexCardBrief[] = [];

  for (let page = 1; page <= ILLUSTRATOR_FETCH_MAX_PAGES; page += 1) {
    const batch = await listCatalogCards(
      locale,
      Query.create()
        .contains("illustrator", token)
        .paginate(page, ILLUSTRATOR_FETCH_PAGE_SIZE),
    );

    if (batch.length === 0) {
      break;
    }

    matches.push(...batch);

    if (batch.length < ILLUSTRATOR_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return matches;
}

function markIllustratorTokenMatches(
  matchesByCardId: Map<string, Set<string>>,
  briefs: readonly TcgdexCardBrief[],
  token: string,
) {
  const normalizedToken = token.toLowerCase();
  for (const brief of briefs) {
    const existing = matchesByCardId.get(brief.id) ?? new Set<string>();
    existing.add(normalizedToken);
    matchesByCardId.set(brief.id, existing);
  }
}

async function fetchCardsBySetIds(
  setIds: readonly string[],
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  if (setIds.length === 0) {
    return [];
  }

  const batches = await Promise.all(
    setIds.map((setId) =>
      listCatalogCards(
        locale,
        Query.create().equal("set", setId).paginate(1, CATALOG_SET_FETCH_LIMIT),
      ),
    ),
  );

  return batches.flat();
}

async function fetchCandidateBriefs(
  parsed: ParsedSearchQuery,
  locale: UiLocale,
): Promise<{
  briefs: TcgdexCardBrief[];
  illustratorTokenMatches: Map<string, Set<string>>;
}> {
  const { tokens, raw } = parsed;
  const numberTokens = tokens.filter(isNumberToken);
  const textTokens = tokens.filter((token) => !isNumberToken(token));
  const setIndex = await getCatalogSetIndex(locale);
  const matchedSetIds = [
    ...new Set(
      textTokens.flatMap((token) => matchCatalogSetIds(token, setIndex)),
    ),
  ];
  const bulkFetchSetIds = [
    ...new Set(
      textTokens.flatMap((token) =>
        matchCatalogSetIdsForBulkFetch(token, setIndex),
      ),
    ),
  ];
  const batches: TcgdexCardBrief[][] = [];
  const illustratorTokenMatches = new Map<string, Set<string>>();

  for (const number of numberTokens) {
    batches.push(await fetchCardsByExactNumber(number, locale));
  }

  if (numberTokens.length > 0 && matchedSetIds.length > 0) {
    for (const setId of matchedSetIds) {
      for (const number of numberTokens) {
        batches.push(
          await listCatalogCards(
            locale,
            Query.create()
              .equal("set", setId)
              .contains("localId", number)
              .paginate(1, CATALOG_SET_FETCH_LIMIT),
          ).then((briefs) =>
            briefs.filter((brief) =>
              numbersMatch(decodeTcgdexLocalId(brief.localId), number),
            ),
          ),
        );
      }
    }
  }

  if (textTokens.length > 0) {
    batches.push(await fetchCardsBySetIds(bulkFetchSetIds, locale));

    if (raw.length >= 2) {
      batches.push(await fetchCardsByNameToken(raw, locale));
      const illustratorMatches = await fetchCardsByIllustratorToken(
        raw,
        locale,
      );
      markIllustratorTokenMatches(
        illustratorTokenMatches,
        illustratorMatches,
        raw,
      );
      batches.push(illustratorMatches);
    }

    for (const token of textTokens) {
      batches.push(await fetchCardsByNameToken(token, locale));
      const illustratorMatches = await fetchCardsByIllustratorToken(
        token,
        locale,
      );
      markIllustratorTokenMatches(
        illustratorTokenMatches,
        illustratorMatches,
        token,
      );
      batches.push(illustratorMatches);
    }
  }

  return {
    briefs: dedupeBriefs(batches.flat()),
    illustratorTokenMatches,
  };
}

async function loadIllustratorsByCardId(
  cardIds: readonly string[],
): Promise<Map<string, string | null>> {
  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: cards.id, illustrator: cards.illustrator })
    .from(cards)
    .where(inArray(cards.id, uniqueCardIds));

  return new Map(rows.map((row) => [row.id, row.illustrator]));
}

async function loadSetMetadataById(
  locale: UiLocale,
  setIds: readonly string[],
): Promise<Map<string, SetMetadata>> {
  const catalogMetadata = getCatalogSetMetadata(
    await getCatalogSetIndex(locale),
  );
  const uniqueSetIds = [...new Set(setIds)];
  const metadataBySetId = new Map<string, SetMetadata>();

  for (const setId of uniqueSetIds) {
    const catalogEntry = catalogMetadata.get(setId);
    if (catalogEntry) {
      metadataBySetId.set(setId, catalogEntry);
    }
  }

  const missingSetIds = uniqueSetIds.filter(
    (setId) => !metadataBySetId.has(setId),
  );
  if (missingSetIds.length === 0) {
    return metadataBySetId;
  }

  const rows = await db
    .select({
      id: sets.id,
      names: sets.names,
      officialCode: sets.officialCode,
    })
    .from(sets)
    .where(inArray(sets.id, missingSetIds));

  for (const row of rows) {
    metadataBySetId.set(row.id, {
      name:
        (row.names as Record<string, string> | null)?.[locale] ??
        (row.names as Record<string, string> | null)?.en ??
        "",
      officialCode: row.officialCode,
    });
  }

  return metadataBySetId;
}

function catalogSearchCacheKey(raw: string, locale: UiLocale): string {
  return `${locale}:${raw.trim().toLowerCase()}`;
}

async function getRankedCatalogSearchBriefs(
  parsed: ParsedSearchQuery,
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  const cacheKey = catalogSearchCacheKey(parsed.raw, locale);
  const cached = catalogSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_SEARCH_CACHE_TTL_MS) {
    return cached.briefs;
  }

  const { briefs: candidateBriefs, illustratorTokenMatches } =
    await fetchCandidateBriefs(parsed, locale);
  if (candidateBriefs.length === 0) {
    catalogSearchCache.set(cacheKey, { fetchedAt: Date.now(), briefs: [] });
    return [];
  }

  const setIds = candidateBriefs.map((brief) =>
    extractSetIdFromCardId(brief.id),
  );
  const setMetadataById = await loadSetMetadataById(locale, setIds);
  const illustratorsByCardId = await loadIllustratorsByCardId(
    candidateBriefs.map((brief) => brief.id),
  );

  const fieldsForBrief = (brief: TcgdexCardBrief): CardSearchFields => {
    const setId = extractSetIdFromCardId(brief.id);
    const setMeta = setMetadataById.get(setId);
    const matchedIllustratorTokens = [
      ...(illustratorTokenMatches.get(brief.id) ?? []),
    ];
    return {
      cardName: brief.name,
      setName: setMeta?.name ?? "",
      officialCode: setMeta?.officialCode ?? null,
      number: decodeTcgdexLocalId(brief.localId),
      illustrator: illustratorsByCardId.get(brief.id) ?? null,
      matchedIllustratorTokens,
    };
  };

  const rankedBriefs = pickDiverseSearchResults(
    candidateBriefs
      .filter((brief) =>
        cardMatchesCatalogSearchQuery(
          parsed.raw,
          parsed.tokens,
          fieldsForBrief(brief),
        ),
      )
      .sort((left, right) => {
        const leftFields = fieldsForBrief(left);
        const rightFields = fieldsForBrief(right);
        const scoreDiff =
          scoreCatalogSearchMatch(parsed.raw, parsed.tokens, rightFields) -
          scoreCatalogSearchMatch(parsed.raw, parsed.tokens, leftFields);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return left.name.length - right.name.length;
      }),
    candidateBriefs.length,
  );

  catalogSearchCache.set(cacheKey, {
    fetchedAt: Date.now(),
    briefs: rankedBriefs,
  });

  return rankedBriefs;
}

export type CatalogSearchPageOptions = {
  offset?: number;
  limit?: number;
  collectionId?: string;
};

export async function searchCatalogCards(
  raw: string,
  locale: UiLocale,
  options: CatalogSearchPageOptions = {},
) {
  const parsed = parseSearchQuery(raw);
  if (parsed.tokens.length === 0) {
    return { results: [], hasMore: false, total: 0 };
  }

  const offset = Math.max(options.offset ?? 0, 0);
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const rankedBriefs = await getRankedCatalogSearchBriefs(parsed, locale);
  const total = rankedBriefs.length;
  const matchingBriefs = rankedBriefs.slice(offset, offset + limit);
  const hasMore = offset + matchingBriefs.length < total;

  if (matchingBriefs.length === 0) {
    return { results: [], hasMore: false, total };
  }

  const setIds = matchingBriefs.map((brief) =>
    extractSetIdFromCardId(brief.id),
  );
  const setMetadataById = await loadSetMetadataById(locale, setIds);
  const briefById = new Map(matchingBriefs.map((brief) => [brief.id, brief]));
  const seriesBySetId = await loadSeriesIdsBySetId(locale, setIds);
  const imageUrlOverrides = new Map(
    matchingBriefs.map((brief) => [
      brief.id,
      resolveBriefImageUrl(brief, seriesBySetId, locale),
    ]),
  );

  const results = await loadCardSearchResults(
    matchingBriefs.map((brief) => brief.id),
    locale,
    imageUrlOverrides,
    options.collectionId,
  );

  return {
    results: results.map((result) => {
      const brief = briefById.get(result.id);
      if (!brief) {
        return result;
      }

      const setId = result.setId || extractSetIdFromCardId(brief.id);
      const setMeta = setMetadataById.get(setId);

      return {
        ...result,
        name: result.name || brief.name,
        number: result.number || decodeTcgdexLocalId(brief.localId),
        setId,
        setName: setMeta?.name ?? result.setName,
        officialCode: setMeta?.officialCode ?? result.officialCode ?? null,
        imageUrl:
          resolveBriefImageUrl(brief, seriesBySetId, locale) ??
          result.imageUrl ??
          null,
      };
    }),
    hasMore,
    total,
  };
}
