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
  CollectionEntriesPageResult,
  CollectionEntryItem,
  CollectionSummary,
} from "@/lib/offline/types";
import { fetchAllEntriesPages } from "@/lib/offline/utils";

const ENTRIES_PAGE_SIZE = 20;

export type LoadResult<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; fromCache: boolean };

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

function shouldUseCacheOnly(): boolean {
  return typeof navigator !== "undefined" && !getIsOnline();
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function entryMatchesQuery(item: CollectionEntryItem, query: string): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalized) ||
    item.number.toLowerCase().includes(normalized) ||
    item.setName.toLowerCase().includes(normalized) ||
    (item.setOfficialCode?.toLowerCase().includes(normalized) ?? false)
  );
}

function paginateEntries(
  items: CollectionEntryItem[],
  offset: number,
  limit: number,
): CollectionEntryItem[] {
  return items.slice(offset, offset + limit);
}

function buildEntriesPageResult(
  allItems: CollectionEntryItem[],
  options: {
    offset: number;
    limit: number;
    query: string;
    cardId: string;
  },
): CollectionEntriesPageResult {
  let filtered = allItems.filter((item) => entryMatchesQuery(item, options.query));
  if (options.cardId) {
    filtered = filtered.filter((item) => item.cardId === options.cardId);
  }

  const pageItems = paginateEntries(filtered, options.offset, options.limit);
  const totalValue = filtered.reduce(
    (sum, item) => sum + (item.value ?? 0),
    0,
  );

  let filterCard: CollectionEntriesPageResult["filterCard"] = null;
  if (options.cardId && options.offset === 0) {
    const match = allItems.find((item) => item.cardId === options.cardId);
    if (match) {
      filterCard = {
        cardId: match.cardId,
        name: match.name,
        number: match.number,
        setId: match.setId,
        setName: match.setName,
      };
    }
  }

  return {
    items: pageItems,
    total: filtered.length,
    totalValue,
    hasMore: options.offset + pageItems.length < filtered.length,
    filterCard,
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

async function mirrorCollectionEntriesPage(
  collectionId: string,
  locale: UiLocale,
): Promise<void> {
  try {
    const { items, total, totalValue } = await fetchAllEntriesPages(
      collectionId,
      locale,
    );
    await putCollectionEntries(collectionId, locale, items, total, totalValue);
  } catch {
    // Best-effort background mirror; failures are non-fatal.
  }
}

export async function loadCollectionEntriesPage(
  collectionId: string,
  locale: UiLocale,
  options: {
    offset?: number;
    limit?: number;
    query?: string;
    cardId?: string;
  } = {},
): Promise<LoadResult<CollectionEntriesPageResult>> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? ENTRIES_PAGE_SIZE;
  const query = options.query ?? "";
  const cardId = options.cardId ?? "";

  if (shouldUseCacheOnly()) {
    const store = await getCollectionEntriesStore(collectionId, locale);
    if (!store) {
      return { ok: false, fromCache: true };
    }

    return {
      ok: true,
      data: buildEntriesPageResult(store.items, {
        offset,
        limit,
        query,
        cardId,
      }),
      fromCache: true,
    };
  }

  try {
    const params = new URLSearchParams({
      collectionId,
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (cardId.trim()) {
      params.set("cardId", cardId.trim());
    }

    const response = await fetch(
      apiUrl(`/api/collection?${params.toString()}`, locale),
    );
    const payload = (await response.json()) as CollectionEntriesPageResult & {
      errorCode?: string;
    };

    if (response.ok) {
      if (offset === 0 && !query.trim() && !cardId.trim()) {
        void mirrorCollectionEntriesPage(collectionId, locale);
      }

      return {
        ok: true,
        data: {
          items: payload.items ?? [],
          total: payload.total ?? payload.items?.length ?? 0,
          totalValue: payload.totalValue ?? 0,
          hasMore: Boolean(payload.hasMore),
          filterCard: payload.filterCard ?? null,
        },
        fromCache: false,
      };
    }
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
    data: buildEntriesPageResult(store.items, {
      offset,
      limit,
      query,
      cardId,
    }),
    fromCache: true,
  };
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
    setName: collection.set?.name ?? collection.collection.setName ?? undefined,
    officialCode: card.officialCode,
    variants: card.variants,
  };
}
