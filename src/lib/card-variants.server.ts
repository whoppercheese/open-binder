import type { PricePreference } from "@/lib/settings";
import { pickPrice } from "@/lib/settings";

export type CardVariantPriceRow = {
  variantId: string;
  variantType: string;
  cardmarketProductId: number | null;
  trendEur: string | null;
  lowEur: string | null;
};

export type CardVariantEntry = {
  id: string;
  variantType: string;
  ownedQuantity: number;
  price: number | null;
  cardmarketProductId: number | null;
};

export function buildCardVariantEntry(
  row: CardVariantPriceRow,
  preference: PricePreference,
  ownedQuantity: number,
): CardVariantEntry {
  return {
    id: row.variantId,
    variantType: row.variantType,
    ownedQuantity,
    price: pickPrice(row, preference),
    cardmarketProductId: row.cardmarketProductId,
  };
}
