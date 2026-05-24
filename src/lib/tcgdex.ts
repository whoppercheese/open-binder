import TCGdex, { type SupportedLanguages } from "@tcgdex/sdk";
import {
  TCGDEX_CATALOG_LANGUAGES,
  type LocalizedStrings,
  type TcgdexLanguage,
} from "@/lib/catalog-languages";

const ASSETS_BASE = "https://assets.tcgdex.net";

export const CATALOG_FALLBACK_LANG = "en" satisfies SupportedLanguages;
export const CATALOG_LANG = "de" satisfies SupportedLanguages;

const LANG_FETCH_CONCURRENCY = 5;

const clients = new Map<SupportedLanguages, TCGdex>();

function getClient(lang: SupportedLanguages = CATALOG_LANG): TCGdex {
  let client = clients.get(lang);
  if (!client) {
    client = new TCGdex(lang);
    client.setCacheTTL(0);
    clients.set(lang, client);
  }
  return client;
}

export type TcgdexSetSummary = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: { total?: number; official?: number };
  releaseDate?: string;
  serie?: { id: string; name: string };
  abbreviation?: { official?: string };
};

export type TcgdexSetDetail = TcgdexSetSummary & {
  cards: Array<{ id: string; localId: string; name: string }>;
};

export type SetCardNameHints = Map<string, LocalizedStrings>;

export type FetchedTcgdexCard = {
  card: TcgdexCard;
  lang: SupportedLanguages;
};

export type TcgdexCardVariants = {
  firstEdition?: boolean;
  holo?: boolean;
  normal?: boolean;
  reverse?: boolean;
  wPromo?: boolean;
};

export type TcgdexCardmarketPricing = {
  updated?: string;
  unit?: string;
  idProduct?: number;
  avg?: number;
  low?: number;
  trend?: number;
  "avg-holo"?: number | null;
  "low-holo"?: number | null;
  "trend-holo"?: number | null;
};

export type TcgdexCard = {
  id: string;
  localId: string;
  name: string;
  rarity?: string;
  set: { id: string; name: string; serie?: { id: string; name: string } };
  variants?: TcgdexCardVariants;
  variants_detailed?: Array<{
    type: string;
    subtype?: string;
    stamp?: string[];
    variantId?: string;
  }>;
  pricing?: {
    cardmarket?: TcgdexCardmarketPricing;
  };
};

export async function fetchSets(
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexSetSummary[]> {
  const sets = await getClient(lang).set.list();
  return (sets ?? []) as TcgdexSetSummary[];
}

/** Union of set IDs across all TCGdex catalog languages. */
export async function fetchCatalogSets(): Promise<TcgdexSetSummary[]> {
  const byId = new Map<string, TcgdexSetSummary>();

  for (const lang of TCGDEX_CATALOG_LANGUAGES) {
    const langSets = await fetchSets(lang);
    for (const set of langSets) {
      if (!byId.has(set.id)) {
        byId.set(set.id, set);
      }
    }
  }

  return Array.from(byId.values());
}

async function runWithConcurrency<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  limit = LANG_FETCH_CONCURRENCY,
) {
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
}

export async function fetchSetAllLangs(
  setId: string,
): Promise<Map<TcgdexLanguage, TcgdexSetDetail>> {
  const results = new Map<TcgdexLanguage, TcgdexSetDetail>();

  await runWithConcurrency(TCGDEX_CATALOG_LANGUAGES, async (lang) => {
    const detail = await fetchSetOptional(setId, lang);
    if (detail) {
      results.set(lang, detail);
    }
  });

  return results;
}

export function buildMultilangNameHints(
  details: Map<TcgdexLanguage, TcgdexSetDetail>,
): SetCardNameHints {
  const hints: SetCardNameHints = new Map();

  for (const [lang, detail] of details) {
    for (const card of detail.cards) {
      const localId = decodeTcgdexLocalId(card.localId);
      const entry = hints.get(localId) ?? {};
      entry[lang] = card.name;
      hints.set(localId, entry);
    }
  }

  return hints;
}

export function mergeSetLocalizedFields(
  details: Map<TcgdexLanguage, TcgdexSetDetail>,
  summary?: TcgdexSetSummary,
): {
  names: LocalizedStrings;
  seriesNames: LocalizedStrings;
  seriesId: string;
  detail: TcgdexSetDetail;
} {
  const names: LocalizedStrings = {};
  const seriesNames: LocalizedStrings = {};
  let seriesId = summary?.serie?.id ?? "unknown";
  let detail: TcgdexSetDetail | null = null;

  for (const [lang, langDetail] of details) {
    names[lang] = langDetail.name;
    if (langDetail.serie?.name) {
      seriesNames[lang] = langDetail.serie.name;
    }
    if (langDetail.serie?.id) {
      seriesId = langDetail.serie.id;
    }
    if (!detail) {
      detail = langDetail;
    }
    if (lang === CATALOG_FALLBACK_LANG) {
      detail = langDetail;
    }
  }

  if (!detail) {
    throw new Error(`TCGdex set not found in any language`);
  }

  return { names, seriesNames, seriesId, detail };
}

export async function fetchSetOptional(
  setId: string,
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexSetDetail | null> {
  const set = await getClient(lang).set.get(setId);
  return set ? (set as TcgdexSetDetail) : null;
}

export async function fetchSet(
  setId: string,
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexSetDetail> {
  const set = await fetchSetOptional(setId, lang);
  if (!set) {
    throw new Error(`TCGdex set not found: ${setId}`);
  }
  return set;
}

export function buildSetCardNameHints(
  deDetail: TcgdexSetDetail,
  enDetail: TcgdexSetDetail,
): SetCardNameHints {
  return buildMultilangNameHints(
    new Map<TcgdexLanguage, TcgdexSetDetail>([
      ["de", deDetail],
      ["en", enDetail],
    ]),
  );
}

export function resolveSetCardSummariesFromDetails(
  deDetail: TcgdexSetDetail,
  enDetail: TcgdexSetDetail,
): TcgdexSetDetail["cards"] {
  if (deDetail.cards.length > 0) {
    return deDetail.cards;
  }

  const expectedCount =
    deDetail.cardCount?.total ?? deDetail.cardCount?.official ?? 0;
  if (expectedCount === 0) {
    return deDetail.cards;
  }

  return enDetail.cards;
}

export async function fetchSetBundle(setId: string): Promise<{
  deDetail: TcgdexSetDetail | null;
  enDetail: TcgdexSetDetail;
  nameHints: SetCardNameHints;
  cardSummaries: TcgdexSetDetail["cards"];
}> {
  const [deDetail, enDetail] = await Promise.all([
    fetchSetOptional(setId, CATALOG_LANG),
    fetchSetOptional(setId, CATALOG_FALLBACK_LANG),
  ]);

  if (!deDetail && !enDetail) {
    throw new Error(`TCGdex set not found: ${setId}`);
  }

  const resolvedEnDetail = enDetail ?? deDetail!;

  return {
    deDetail,
    enDetail: resolvedEnDetail,
    nameHints: deDetail
      ? buildSetCardNameHints(deDetail, resolvedEnDetail)
      : buildEnOnlySetCardNameHints(resolvedEnDetail),
    cardSummaries: deDetail
      ? resolveSetCardSummariesFromDetails(deDetail, resolvedEnDetail)
      : resolvedEnDetail.cards,
  };
}

function buildEnOnlySetCardNameHints(
  enDetail: TcgdexSetDetail,
): SetCardNameHints {
  return buildMultilangNameHints(
    new Map<TcgdexLanguage, TcgdexSetDetail>([["en", enDetail]]),
  );
}

export function decodeTcgdexLocalId(localId: string): string {
  if (!localId.includes("%")) {
    return localId;
  }

  try {
    return decodeURIComponent(localId);
  } catch {
    return localId;
  }
}

function normalizeTcgdexCard(card: TcgdexCard): TcgdexCard {
  return {
    ...card,
    localId: decodeTcgdexLocalId(card.localId),
  };
}

async function fetchCardFromClient(
  client: TCGdex,
  cardId: string,
): Promise<TcgdexCard | null> {
  const card = await client.card.get(cardId);
  if (!card) {
    return null;
  }
  return normalizeTcgdexCard(card as TcgdexCard);
}

export async function fetchCard(
  cardId: string,
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexCard> {
  const card = await fetchCardFromClient(getClient(lang), cardId);
  if (!card) {
    throw new Error(`TCGdex card not found: ${cardId}`);
  }
  return card;
}

export async function fetchCardWithFallback(
  cardId: string,
  lang: SupportedLanguages = CATALOG_FALLBACK_LANG,
  fallbackLang: SupportedLanguages = CATALOG_LANG,
): Promise<FetchedTcgdexCard> {
  const primary = await fetchCardFromClient(getClient(lang), cardId);
  if (primary) {
    return { card: primary, lang };
  }

  if (lang === fallbackLang) {
    throw new Error(`TCGdex card not found: ${cardId}`);
  }

  const fallback = await fetchCardFromClient(getClient(fallbackLang), cardId);
  if (fallback) {
    return { card: fallback, lang: fallbackLang };
  }

  throw new Error(`TCGdex card not found: ${cardId}`);
}

/** @deprecated Use fetchSetBundle instead */
export async function resolveSetCardSummaries(
  setId: string,
  detail: TcgdexSetDetail,
  lang: SupportedLanguages = CATALOG_LANG,
  fallbackLang: SupportedLanguages = CATALOG_FALLBACK_LANG,
): Promise<TcgdexSetDetail["cards"]> {
  if (detail.cards.length > 0) {
    return detail.cards;
  }

  const expectedCount =
    detail.cardCount?.total ?? detail.cardCount?.official ?? 0;
  if (expectedCount === 0 || lang === fallbackLang) {
    return detail.cards;
  }

  const fallbackDetail = await fetchSet(setId, fallbackLang);
  return fallbackDetail.cards;
}

const TCGDEX_ASSETS_HOST = "assets.tcgdex.net";
const TCGDEX_SET_ASSET_KINDS = new Set(["logo", "symbol"]);

export function buildImageUrl(
  seriesId: string,
  setId: string,
  localId: string,
  lang = "en",
  quality: "high" | "low" = "high",
): string {
  return `${ASSETS_BASE}/${lang}/${seriesId}/${setId}/${encodeURIComponent(localId)}/${quality}.webp`;
}

function isTcgdexCardAssetUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== TCGDEX_ASSETS_HOST) {
      return false;
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length !== 4) {
      return false;
    }

    const lastSegment = segments[3];
    return !TCGDEX_SET_ASSET_KINDS.has(lastSegment);
  } catch {
    return false;
  }
}

export function resolveTcgdexAssetUrl(
  url: string,
  extension: "webp" | "png" | "jpg" = "webp",
): string {
  if (/\.(webp|png|jpe?g)$/i.test(url)) {
    return url;
  }

  if (isTcgdexCardAssetUrl(url)) {
    return `${url}/high.webp`;
  }

  return `${url}.${extension}`;
}

export type VariantType =
  | "normal"
  | "holo"
  | "reverse_holo"
  | "first_edition";

export function deriveVariantTypes(
  variants?: TcgdexCardVariants,
): VariantType[] {
  if (!variants) return ["normal"];

  const result: VariantType[] = [];
  if (variants.normal) result.push("normal");
  if (variants.holo) result.push("holo");
  if (variants.reverse) result.push("reverse_holo");
  if (variants.firstEdition) result.push("first_edition");

  return result.length > 0 ? result : ["normal"];
}

function usesCardmarketFoilBucket(
  variantType: VariantType,
  variants?: TcgdexCardVariants,
): boolean {
  switch (variantType) {
    case "normal":
      return false;
    case "holo":
    case "reverse_holo":
      return true;
    case "first_edition":
      // Vintage holo rares (e.g. Base Set): 1st edition prices sit in the standard bucket.
      if (variants?.holo && !variants.normal) {
        return false;
      }
      return true;
  }
}

/** Infer foil bucket for Cardmarket links from synced variant types. */
export function cardmarketIsFoilForVariant(
  variantType: VariantType,
  availableVariantTypes: VariantType[],
): boolean {
  const hasNormal = availableVariantTypes.includes("normal");
  const hasHolo = availableVariantTypes.includes("holo");

  switch (variantType) {
    case "normal":
      return false;
    case "holo":
    case "reverse_holo":
      return true;
    case "first_edition":
      return hasNormal || !hasHolo;
  }
}

export function pricingForVariant(
  variantType: VariantType,
  pricing?: TcgdexCardmarketPricing,
  variants?: TcgdexCardVariants,
) {
  if (!pricing) return null;

  const useFoilBucket = usesCardmarketFoilBucket(variantType, variants);

  const trend = useFoilBucket
    ? (pricing["trend-holo"] ?? pricing.trend)
    : pricing.trend;
  const low = useFoilBucket
    ? (pricing["low-holo"] ?? pricing.low)
    : pricing.low;
  const avg = useFoilBucket
    ? (pricing["avg-holo"] ?? pricing.avg)
    : pricing.avg;

  return {
    trendEur: trend ?? null,
    lowEur: low ?? null,
    avgEur: avg ?? null,
    cardmarketProductId: pricing.idProduct ?? null,
    updatedAt: pricing.updated ?? null,
  };
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
