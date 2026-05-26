import type { TranslateFn } from "@/lib/i18n/messages";

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
  collectionId: string;
  variantId: string;
  quantity?: number;
  condition?: string;
  language?: string;
  notes?: string | null;
  purchasePrice?: number | null;
  flagged?: boolean;
};

const COLLECTION_ERROR_KEYS: Record<string, string> = {
  COLLECTION_ADD_FAILED: "errors.collectionAddFailed",
  COLLECTION_LOAD_FAILED: "errors.collectionLoadFailed",
  VARIANT_ID_REQUIRED: "errors.variantIdRequired",
  VARIANT_NOT_FOUND: "errors.variantNotFound",
  CARD_LOAD_FAILED: "errors.cardLoadFailed",
  CARD_NOT_FOUND: "errors.cardNotFound",
  SAVE_FAILED: "errors.saveFailed",
  ADD_FAILED: "errors.addFailed",
};

export function translateCollectionError(
  code: string | undefined,
  t: TranslateFn,
  fallback = "errors.saveFailed",
): string {
  const key = (code && COLLECTION_ERROR_KEYS[code]) ?? fallback;
  return t(key);
}

export async function addToCollection({
  collectionId,
  variantId,
  quantity = 1,
  condition = "nm",
  language = "de",
  notes = null,
  purchasePrice = null,
  flagged = false,
}: AddToCollectionInput): Promise<void> {
  const response = await fetch("/api/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collectionId,
      variantId,
      quantity,
      condition,
      language,
      notes,
      purchasePrice,
      flagged,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { errorCode?: string };
    throw new Error(payload.errorCode ?? "SAVE_FAILED");
  }
}

export type UpdateCollectionInput = {
  quantity?: number;
  condition?: string;
  language?: string;
  notes?: string | null;
  purchasePrice?: number | null;
  flagged?: boolean;
};

export async function updateCollection(
  entryId: string,
  input: UpdateCollectionInput,
): Promise<void> {
  const response = await fetch(`/api/collection/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { errorCode?: string };
    throw new Error(payload.errorCode ?? "SAVE_FAILED");
  }
}

export type CollectionCoverUpdate = {
  coverCardId: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
};

export async function setCollectionCover(
  collectionId: string,
  coverCardId: string,
): Promise<CollectionCoverUpdate> {
  const response = await fetch(`/api/collections/${collectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coverCardId }),
  });

  const payload = (await response.json()) as {
    errorCode?: string;
    collection?: CollectionCoverUpdate & {
      id: string;
      name: string;
    };
  };

  if (!response.ok) {
    throw new Error(payload.errorCode ?? "SAVE_FAILED");
  }

  if (!payload.collection) {
    throw new Error("SAVE_FAILED");
  }

  return {
    coverCardId: payload.collection.coverCardId,
    coverImageUrl: payload.collection.coverImageUrl,
    updatedAt: payload.collection.updatedAt,
  };
}
