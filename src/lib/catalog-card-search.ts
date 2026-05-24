import "server-only";

import TCGdex, { Query } from "@tcgdex/sdk";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import {
  extractSetIdFromCardId,
  loadCardSearchResults,
} from "@/lib/card-search-results.server";
import {
  getCatalogSetIndex,
  getCatalogSetMetadata,
  matchCatalogSetIds,
} from "@/lib/catalog-set-index.server";
import type { UiLocale } from "@/lib/i18n/locale";
import {
  cardMatchesAllTokens,
  isNumberToken,
  numbersMatch,
  parseSearchQuery,
} from "@/lib/search";
import {
  buildImageUrl,
  decodeTcgdexLocalId,
  resolveTcgdexAssetUrl,
} from "@/lib/tcgdex";

const SEARCH_LIMIT = 50;
const NUMBER_FETCH_PAGE_SIZE = 100;
const NUMBER_FETCH_MAX_PAGES = 3;
const NAME_FETCH_PAGE_SIZE = 100;

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

const clients = new Map<UiLocale, TCGdex>();

function getCatalogClient(locale: UiLocale): TCGdex {
  let client = clients.get(locale);
  if (!client) {
    client = new TCGdex(locale);
    client.setCacheTTL(0);
    clients.set(locale, client);
  }
  return client;
}

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
  const cards = await getCatalogClient(locale).card.list(query);
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
): string | null {
  if (brief.image) {
    return resolveTcgdexAssetUrl(brief.image);
  }

  const setId = extractSetIdFromCardId(brief.id);
  const seriesId = seriesIdBySetId.get(setId);
  if (!seriesId) {
    return null;
  }

  return buildImageUrl(
    seriesId,
    setId,
    decodeTcgdexLocalId(brief.localId),
  );
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

  const missingSetIds = uniqueSetIds.filter((setId) => !seriesBySetId.has(setId));
  if (missingSetIds.length === 0) {
    return seriesBySetId;
  }

  const client = getCatalogClient(locale);
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
  return listCatalogCards(
    locale,
    Query.create()
      .contains("name", token)
      .paginate(1, NAME_FETCH_PAGE_SIZE),
  );
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
        Query.create().equal("set", setId).paginate(1, SEARCH_LIMIT),
      ),
    ),
  );

  return batches.flat();
}

async function fetchCandidateBriefs(
  tokens: readonly string[],
  locale: UiLocale,
): Promise<TcgdexCardBrief[]> {
  const numberTokens = tokens.filter(isNumberToken);
  const textTokens = tokens.filter((token) => !isNumberToken(token));
  const setIndex = await getCatalogSetIndex(locale);
  const matchedSetIds = [
    ...new Set(textTokens.flatMap((token) => matchCatalogSetIds(token, setIndex))),
  ];
  const batches: TcgdexCardBrief[][] = [];

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
              .paginate(1, SEARCH_LIMIT),
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
    batches.push(await fetchCardsBySetIds(matchedSetIds, locale));

    for (const token of textTokens) {
      batches.push(await fetchCardsByNameToken(token, locale));
    }
  }

  return dedupeBriefs(batches.flat());
}

async function loadSetMetadataById(
  locale: UiLocale,
  setIds: readonly string[],
): Promise<Map<string, SetMetadata>> {
  const catalogMetadata = getCatalogSetMetadata(await getCatalogSetIndex(locale));
  const uniqueSetIds = [...new Set(setIds)];
  const metadataBySetId = new Map<string, SetMetadata>();

  for (const setId of uniqueSetIds) {
    const catalogEntry = catalogMetadata.get(setId);
    if (catalogEntry) {
      metadataBySetId.set(setId, catalogEntry);
    }
  }

  const missingSetIds = uniqueSetIds.filter((setId) => !metadataBySetId.has(setId));
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

export async function searchCatalogCards(raw: string, locale: UiLocale) {
  const parsed = parseSearchQuery(raw);
  if (parsed.tokens.length === 0) {
    return [];
  }

  const candidateBriefs = await fetchCandidateBriefs(parsed.tokens, locale);
  if (candidateBriefs.length === 0) {
    return [];
  }

  const setIds = candidateBriefs.map((brief) => extractSetIdFromCardId(brief.id));
  const setMetadataById = await loadSetMetadataById(locale, setIds);

  const matchingBriefs = candidateBriefs
    .filter((brief) => {
      const setId = extractSetIdFromCardId(brief.id);
      const setMeta = setMetadataById.get(setId);
      return cardMatchesAllTokens(parsed.tokens, {
        cardName: brief.name,
        setName: setMeta?.name ?? "",
        officialCode: setMeta?.officialCode ?? null,
        number: decodeTcgdexLocalId(brief.localId),
      });
    })
    .slice(0, SEARCH_LIMIT);

  if (matchingBriefs.length === 0) {
    return [];
  }

  const briefById = new Map(matchingBriefs.map((brief) => [brief.id, brief]));
  const seriesBySetId = await loadSeriesIdsBySetId(locale, setIds);
  const imageUrlOverrides = new Map(
    matchingBriefs.map((brief) => [
      brief.id,
      resolveBriefImageUrl(brief, seriesBySetId),
    ]),
  );

  const results = await loadCardSearchResults(
    matchingBriefs.map((brief) => brief.id),
    locale,
    imageUrlOverrides,
  );

  return results.map((result) => {
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
      imageUrl: result.imageUrl ?? resolveBriefImageUrl(brief, seriesBySetId),
    };
  });
}
