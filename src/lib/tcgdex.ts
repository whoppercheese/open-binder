const TCGDEX_BASE = "https://api.tcgdex.net/v2";
const ASSETS_BASE = "https://assets.tcgdex.net";

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`TCGdex request failed (${response.status}): ${url}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchSets(lang = "de"): Promise<TcgdexSetSummary[]> {
  return fetchJson(`${TCGDEX_BASE}/${lang}/sets`);
}

export async function fetchSet(
  setId: string,
  lang = "de",
): Promise<TcgdexSetDetail> {
  return fetchJson(`${TCGDEX_BASE}/${lang}/sets/${setId}`);
}

export async function fetchCard(
  cardId: string,
  lang = "de",
): Promise<TcgdexCard> {
  return fetchJson(`${TCGDEX_BASE}/${lang}/cards/${cardId}`);
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
