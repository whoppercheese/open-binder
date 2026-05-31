import { cardmarketLocalePath, type UiLocale } from "@/lib/i18n/locale";

const PRODUCT_CATALOG_URL =
  "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json";

export type CardmarketProduct = {
  idProduct: number;
  name: string;
  idCategory: number;
  categoryName: string;
  idExpansion: number;
  idMetacard: number;
  dateAdded: string;
};

export type CardmarketProductCatalog = {
  version: number;
  createdAt: string;
  products: CardmarketProduct[];
};

export type CardmarketPriceEntry = {
  idProduct: number;
  trend: number | null;
  low: number | null;
  avg: number | null;
};

export async function fetchProductCatalog(): Promise<CardmarketProductCatalog> {
  const response = await fetch(PRODUCT_CATALOG_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Cardmarket product catalog download failed (${response.status})`,
    );
  }
  return response.json() as Promise<CardmarketProductCatalog>;
}

export function getCardmarketConditionHelpUrl(locale?: UiLocale): string {
  const lang = cardmarketLocalePath(locale ?? "en");
  return `https://help.cardmarket.com/${lang}/CardCondition`;
}

export function getCardmarketProductUrl(
  productId: number,
  options?: { foil?: boolean; locale?: UiLocale },
): string {
  const lang = cardmarketLocalePath(options?.locale ?? "en");
  const url = new URL(`https://www.cardmarket.com/${lang}/Pokemon/Products`);
  url.searchParams.set("idProduct", String(productId));
  if (options?.foil) {
    url.searchParams.set("isFoil", "Y");
  }
  return url.toString();
}

export function buildPriceMapFromTcgdexEntries(
  entries: Array<{
    idProduct: number;
    trend?: number | null;
    low?: number | null;
    avg?: number | null;
  }>,
): Map<number, CardmarketPriceEntry> {
  const map = new Map<number, CardmarketPriceEntry>();
  for (const entry of entries) {
    if (!entry.idProduct) continue;
    map.set(entry.idProduct, {
      idProduct: entry.idProduct,
      trend: entry.trend ?? null,
      low: entry.low ?? null,
      avg: entry.avg ?? null,
    });
  }
  return map;
}
