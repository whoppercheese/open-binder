import type { CardDetail } from "@/components/card-modal";
import { apiUrl } from "@/lib/i18n/context";
import type { UiLocale } from "@/lib/i18n/locale";
import { getIsOnline } from "@/lib/offline/connection-state";
import {
  getAllCollections,
  getCollectionEntriesStore,
  getStoredCardDetail,
  getStoredCollectionDetail,
  putCardDetail,
  putCollectionDetail,
  putCollectionEntries,
  putCollections,
} from "@/lib/offline/db";
import type {
  CollectionDetailResponse,
  CollectionEntryItem,
  CollectionSummary,
} from "@/lib/offline/types";
import { fetchAllEntriesPages } from "@/lib/offline/utils";
import {
  normalizeLegacyCondition,
  sortAvailableConditions,
  type CardCondition,
} from "@/lib/utils";

export type LoadResult<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; fromCache: boolean };

export type CollectionEntriesLoadResult = {
  items: CollectionEntryItem[];
  total: number;
};

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

function shouldUseCacheOnly(): boolean {
  return typeof navigator !== "undefined" && !getIsOnline();
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function entryMatchesQuery(
  item: CollectionEntryItem,
  query: string,
): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalized) ||
    item.number.toLowerCase().includes(normalized) ||
    item.setName.toLowerCase().includes(normalized) ||
    (item.setOfficialCode?.toLowerCase().includes(normalized) ?? false) ||
    (item.illustrator?.toLowerCase().includes(normalized) ?? false)
  );
}

export function filterCollectionEntries(
  allItems: CollectionEntryItem[],
  options: {
    query?: string;
    cardId?: string;
    condition?: string | null;
  },
): CollectionEntryItem[] {
  const query = options.query ?? "";
  const cardId = options.cardId ?? "";
  let filtered = allItems.filter((item) => entryMatchesQuery(item, query));
  if (cardId) {
    filtered = filtered.filter((item) => item.cardId === cardId);
  }
  if (options.condition) {
    filtered = filtered.filter(
      (item) =>
        normalizeLegacyCondition(item.condition) === options.condition,
    );
  }
  return filtered;
}

export function collectAvailableConditions(
  allItems: CollectionEntryItem[],
  cardId: string,
): CardCondition[] {
  const scoped = cardId
    ? allItems.filter((item) => item.cardId === cardId)
    : allItems;
  return sortAvailableConditions(scoped.map((item) => item.condition));
}

export async function loadAllCollectionEntries(
  collectionId: string,
  locale: UiLocale,
): Promise<LoadResult<CollectionEntriesLoadResult>> {
  if (shouldUseCacheOnly()) {
    const store = await getCollectionEntriesStore(collectionId, locale);
    if (!store) {
      return { ok: false, fromCache: true };
    }

    return {
      ok: true,
      data: {
        items: store.items,
        total: store.total,
      },
      fromCache: true,
    };
  }

  try {
    const { items, total } = await fetchAllEntriesPages(
      collectionId,
      locale,
    );
    await putCollectionEntries(collectionId, locale, items, total);
    return {
      ok: true,
      data: { items, total },
      fromCache: false,
    };
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
  }

  const store = await getCollectionEntriesStore(collectionId, locale);
  if (!store) {
    return { ok: false, fromCache: true };
  }

  return {
    ok: true,
    data: {
      items: store.items,
      total: store.total,
    },
    fromCache: true,
  };
}

export async function loadCollections(
  locale: UiLocale,
): Promise<LoadResult<CollectionSummary[]>> {
  if (shouldUseCacheOnly()) {
    const cached = await getAllCollections();
    return cached.length > 0
      ? { ok: true, data: cached, fromCache: true }
      : { ok: false, fromCache: true };
  }

  try {
    const response = await fetch(apiUrl("/api/collections", locale));
    const payload = (await response.json()) as { items?: CollectionSummary[] };
    if (response.ok) {
      const items = payload.items ?? [];
      await putCollections(items);
      return { ok: true, data: items, fromCache: false };
    }
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
  }

  const cached = await getAllCollections();
  return cached.length > 0
    ? { ok: true, data: cached, fromCache: true }
    : { ok: false, fromCache: true };
}

export async function loadCollectionDetail(
  collectionId: string,
  locale: UiLocale,
): Promise<LoadResult<CollectionDetailResponse>> {
  if (shouldUseCacheOnly()) {
    const cached = await getStoredCollectionDetail(collectionId, locale);
    return cached
      ? { ok: true, data: cached, fromCache: true }
      : { ok: false, fromCache: true };
  }

  try {
    const response = await fetch(
      apiUrl(`/api/collections/${collectionId}/cards`, locale),
    );
    const payload = (await response.json()) as CollectionDetailResponse;
    if (response.ok && payload.collection) {
      const list = await getAllCollections();
      const summary = list.find((item) => item.id === collectionId);
      await putCollectionDetail(
        collectionId,
        locale,
        summary?.updatedAt ?? new Date().toISOString(),
        payload,
      );
      return { ok: true, data: payload, fromCache: false };
    }
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
  }

  const cached = await getStoredCollectionDetail(collectionId, locale);
  return cached
    ? { ok: true, data: cached, fromCache: true }
    : { ok: false, fromCache: true };
}

export async function loadCardDetail(
  cardId: string,
  collectionId: string,
  locale: UiLocale,
  fallback?: CardDetail | null,
): Promise<LoadResult<CardDetail>> {
  if (shouldUseCacheOnly()) {
    const cached =
      (await getStoredCardDetail(cardId, collectionId, locale)) ?? fallback;
    return cached
      ? { ok: true, data: cached, fromCache: true }
      : { ok: false, fromCache: true };
  }

  try {
    const response = await fetch(
      apiUrl(
        `/api/cards/${cardId}?collectionId=${encodeURIComponent(collectionId)}`,
        locale,
      ),
    );
    const payload = (await response.json()) as CardDetail;
    if (response.ok) {
      await putCardDetail(cardId, collectionId, locale, payload);
      return { ok: true, data: payload, fromCache: false };
    }
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
  }

  const cached =
    (await getStoredCardDetail(cardId, collectionId, locale)) ?? fallback;
  return cached
    ? { ok: true, data: cached, fromCache: true }
    : { ok: false, fromCache: true };
}

export function cardDetailFromCollectionCard(
  card: CollectionDetailResponse["cards"][number],
  collection: CollectionDetailResponse,
): CardDetail {
  return {
    id: card.id,
    number: card.number,
    name: card.name,
    imageUrl: card.imageUrl,
    setId: card.setId,
    setName: card.setName || collection.set?.name || collection.collection.setName || undefined,
    officialCode: card.officialCode,
    variants: card.variants,
  };
}
