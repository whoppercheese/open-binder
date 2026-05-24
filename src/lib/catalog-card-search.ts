import "server-only";

import TCGdex, { Query } from "@tcgdex/sdk";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import {
  extractSetIdFromCardId,
  loadCardSearchResults,
} from "@/lib/card-search-results.server";
import type { UiLocale } from "@/lib/i18n/locale";
import { parseSearchQuery } from "@/lib/search";
import { resolveMatchingSetIds } from "@/lib/set-search.server";
import {
  buildImageUrl,
  decodeTcgdexLocalId,
  resolveTcgdexAssetUrl,
} from "@/lib/tcgdex";

const SEARCH_LIMIT = 50;
const SET_HINT_LIMIT = 8;

type TcgdexCardBrief = {
  id: string;
  localId: string;
  name: string;
  image?: string;
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

async function resolveSetIdsForHint(
  setHint: string,
  locale: UiLocale,
): Promise<string[]> {
  const localMatches = await resolveMatchingSetIds(
    setHint,
    locale,
    SET_HINT_LIMIT,
  );
  if (localMatches.length > 0) {
    return localMatches;
  }

  const remoteSets = await getCatalogClient(locale).set.list(
    Query.create().contains("name", setHint).paginate(1, SET_HINT_LIMIT),
  );

  return (remoteSets ?? []).map((set) => set.id);
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
    if (result.length >= SEARCH_LIMIT) {
      break;
    }
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

export async function searchCatalogCards(raw: string, locale: UiLocale) {
  const parsed = parseSearchQuery(raw);
  if (!parsed.text) {
    return [];
  }

  let briefs: TcgdexCardBrief[] = [];

  if (parsed.setHint && parsed.number) {
    const setIds = await resolveSetIdsForHint(parsed.setHint, locale);

    if (setIds.length === 0) {
      return [];
    }

    const batches = await Promise.all(
      setIds.map((setId) =>
        listCatalogCards(
          locale,
          Query.create()
            .equal("set", setId)
            .contains("localId", parsed.number!)
            .paginate(1, SEARCH_LIMIT),
        ),
      ),
    );
    briefs = batches.flat();
  } else if (parsed.number && !parsed.setHint) {
    briefs = await listCatalogCards(
      locale,
      Query.create()
        .contains("localId", parsed.number)
        .paginate(1, SEARCH_LIMIT),
    );
  } else {
    briefs = await listCatalogCards(
      locale,
      Query.create()
        .contains("name", parsed.text)
        .paginate(1, SEARCH_LIMIT),
    );
  }

  const uniqueBriefs = dedupeBriefs(briefs);
  if (uniqueBriefs.length === 0) {
    return [];
  }

  const briefById = new Map(uniqueBriefs.map((brief) => [brief.id, brief]));
  const seriesBySetId = await loadSeriesIdsBySetId(
    locale,
    uniqueBriefs.map((brief) => extractSetIdFromCardId(brief.id)),
  );
  const imageUrlOverrides = new Map(
    uniqueBriefs.map((brief) => [
      brief.id,
      resolveBriefImageUrl(brief, seriesBySetId),
    ]),
  );

  const results = await loadCardSearchResults(
    uniqueBriefs.map((brief) => brief.id),
    locale,
    imageUrlOverrides,
  );

  return results.map((result) => {
    const brief = briefById.get(result.id);
    if (!brief) {
      return result;
    }

    return {
      ...result,
      name: result.name || brief.name,
      number: result.number || brief.localId,
      setId: result.setId || extractSetIdFromCardId(brief.id),
      imageUrl: result.imageUrl ?? resolveBriefImageUrl(brief, seriesBySetId),
    };
  });
}
