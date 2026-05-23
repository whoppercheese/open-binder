export type CollectionVariantOption = {
  id: string;
  ownedQuantity?: number | null;
};

export function pickDefaultVariantId(
  variants: CollectionVariantOption[],
): string | null {
  const defaultVariant =
    variants.find((variant) => (variant.ownedQuantity ?? 0) > 0) ??
    variants[0] ??
    null;

  return defaultVariant?.id ?? null;
}

export type AddToCollectionInput = {
  variantId: string;
  quantity?: number;
  condition?: string;
  language?: string;
  notes?: string | null;
  purchasePrice?: number | null;
};

export async function addToCollection({
  variantId,
  quantity = 1,
  condition = "nm",
  language = "de",
  notes = null,
  purchasePrice = null,
}: AddToCollectionInput): Promise<void> {
  const response = await fetch("/api/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variantId,
      quantity,
      condition,
      language,
      notes,
      purchasePrice,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Speichern fehlgeschlagen");
  }
}
