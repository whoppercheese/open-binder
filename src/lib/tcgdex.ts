import TCGdex, { type SupportedLanguages } from "@tcgdex/sdk";

const ASSETS_BASE = "https://assets.tcgdex.net";

export const CATALOG_LANG = "de" satisfies SupportedLanguages;
export const CATALOG_FALLBACK_LANG = "en" satisfies SupportedLanguages;

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

export async function fetchSet(
  setId: string,
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexSetDetail> {
  const set = await getClient(lang).set.get(setId);
  if (!set) {
    throw new Error(`TCGdex set not found: ${setId}`);
  }
  return set as TcgdexSetDetail;
}

export async function fetchCard(
  cardId: string,
  lang: SupportedLanguages = CATALOG_LANG,
): Promise<TcgdexCard> {
  const card = await getClient(lang).card.get(cardId);
  if (!card) {
    throw new Error(`TCGdex card not found: ${cardId}`);
  }
  return card as TcgdexCard;
}

export async function fetchCardWithFallback(
  cardId: string,
  lang: SupportedLanguages = CATALOG_LANG,
  fallbackLang: SupportedLanguages = CATALOG_FALLBACK_LANG,
): Promise<TcgdexCard> {
  const primary = await getClient(lang).card.get(cardId);
  if (primary) {
    return primary as TcgdexCard;
  }

  if (lang === fallbackLang) {
    throw new Error(`TCGdex card not found: ${cardId}`);
  }

  const fallback = await getClient(fallbackLang).card.get(cardId);
  if (fallback) {
    return fallback as TcgdexCard;
  }

  throw new Error(`TCGdex card not found: ${cardId}`);
}

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

export function buildImageUrl(
  seriesId: string,
  setId: string,
  localId: string,
  lang = "en",
  quality: "high" | "low" = "high",
): string {
  return `${ASSETS_BASE}/${lang}/${seriesId}/${setId}/${localId}/${quality}.webp`;
}

export function resolveTcgdexAssetUrl(
  url: string,
  extension: "webp" | "png" | "jpg" = "webp",
): string {
  if (/\.(webp|png|jpe?g)$/i.test(url)) {
    return url;
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

export function pricingForVariant(
  variantType: VariantType,
  pricing?: TcgdexCardmarketPricing,
) {
  if (!pricing) return null;

  const isHoloVariant =
    variantType === "holo" || variantType === "first_edition";

  const trend =
    isHoloVariant && pricing["trend-holo"] != null
      ? pricing["trend-holo"]
      : pricing.trend;
  const low =
    isHoloVariant && pricing["low-holo"] != null
      ? pricing["low-holo"]
      : pricing.low;
  const avg =
    isHoloVariant && pricing["avg-holo"] != null
      ? pricing["avg-holo"]
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
