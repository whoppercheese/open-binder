import type { CardDetail } from "@/components/card-modal";
import type { UiLocale } from "@/lib/i18n/locale";
import type { CardCondition } from "@/lib/utils";

export const OFFLINE_DB_NAME = "openbinder-offline";
export const OFFLINE_DB_VERSION = 2;
export const OFFLINE_SCHEMA_VERSION = 1;

export type CollectionSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  coverImageUrl: string | null;
  type: "set" | "custom";
  setId: string | null;
  setOfficialCode: string | null;
  ownedCount: number;
  totalCount: number;
  percent: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionDetailCard = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  imageUrl: string | null;
  setId: string;
  setName?: string;
  officialCode: string | null;
  illustrator: string | null;
  owned: boolean;
  ownedQuantity: number;
  flagged: boolean;
  variants: Array<{
    id: string;
    variantType: string;
    ownedQuantity: number;
    price: number | null;
    cardmarketProductId: number | null;
  }>;
};

export type CollectionDetailResponse = {
  collection: {
    id: string;
    name: string;
    imageUrl: string | null;
    coverCardId: string | null;
    coverImageUrl: string | null;
    type: "set" | "custom";
    setId: string | null;
    setName: string | null;
  };
  cards: CollectionDetailCard[];
  progress: {
    ownedCards: number;
    totalCards: number;
    percent: number;
  };
  set: {
    id: string;
    name: string;
    officialCode: string | null;
  } | null;
};

export type CollectionEntryItem = {
  id: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string | null;
  flagged: boolean;
  variantId: string;
  variantType: string;
  cardId: string;
  name: string;
  number: string;
  setId: string;
  setName: string;
  setOfficialCode: string | null;
  illustrator: string | null;
  imageUrl: string | null;
  price: number | null;
  value: number | null;
};

export type CollectionEntriesStore = {
  key: string;
  collectionId: string;
  locale: UiLocale;
  items: CollectionEntryItem[];
  total: number;
  totalValue: number;
  syncedAt: string;
};

export type CollectionDetailStore = {
  key: string;
  collectionId: string;
  locale: UiLocale;
  updatedAt: string;
  data: CollectionDetailResponse;
};

export type CardDetailStore = {
  key: string;
  cardId: string;
  collectionId: string;
  locale: UiLocale;
  data: CardDetail;
};

export type OfflineMeta = {
  id: "meta";
  schemaVersion: number;
  lastFullSyncAt: string | null;
  locale: UiLocale;
};

export type CollectionEntriesPageResult = {
  items: CollectionEntryItem[];
  total: number;
  totalValue: number;
  hasMore: boolean;
  availableConditions?: CardCondition[];
  filterCard: {
    cardId: string;
    name: string;
    number: string;
    setId: string;
    setName: string;
  } | null;
};

export function collectionDetailKey(
  collectionId: string,
  locale: UiLocale,
): string {
  return `${collectionId}:${locale}`;
}

export function collectionEntriesKey(
  collectionId: string,
  locale: UiLocale,
): string {
  return `${collectionId}:${locale}`;
}

export function cardDetailKey(
  cardId: string,
  collectionId: string,
  locale: UiLocale,
): string {
  return `${cardId}:${collectionId}:${locale}`;
}

export const COLLECTION_MUTATED_EVENT = "openbinder-collection-mutated";
export const FULL_MIRROR_EVENT = "openbinder-full-mirror";

export type CollectionMutatedDetail = {
  collectionId?: string;
};

export function notifyCollectionMutated(collectionId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CollectionMutatedDetail>(COLLECTION_MUTATED_EVENT, {
      detail: { collectionId },
    }),
  );
}

export function notifyFullMirror() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FULL_MIRROR_EVENT));
}
