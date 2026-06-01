export type CardVariantRow = {
  variantId: string;
  variantType: string;
  cardmarketProductId: number | null;
};

export type CardVariantEntry = {
  id: string;
  variantType: string;
  ownedQuantity: number;
  cardmarketProductId: number | null;
};

export function buildCardVariantEntry(
  row: CardVariantRow,
  ownedQuantity: number,
): CardVariantEntry {
  return {
    id: row.variantId,
    variantType: row.variantType,
    ownedQuantity,
    cardmarketProductId: row.cardmarketProductId,
  };
}
