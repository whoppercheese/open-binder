import { apiUrl } from "@/lib/i18n/context";
import type { UiLocale } from "@/lib/i18n/locale";
import { getIsOnline } from "@/lib/offline/connection-state";
import {
  deleteCollectionData,
  deleteCollectionsExcept,
  getStoredCollectionDetailStore,
  putCollectionDetail,
  putCollectionEntries,
  putCollections,
  setOfflineMeta,
} from "@/lib/offline/db";
import type {
  CollectionDetailResponse,
  CollectionSummary,
} from "@/lib/offline/types";
import { fetchAllEntriesPages, mapWithConcurrency } from "@/lib/offline/utils";
import { prefetchCollectionShells } from "@/lib/offline/prefetch-shells";

const COLLECTION_MIRROR_CONCURRENCY = 2;

let syncInFlight: Promise<void> | null = null;

function isFetchNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

async function mirrorCollectionDetail(
  collectionId: string,
  locale: UiLocale,
  updatedAt: string,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/collections/${collectionId}/cards`, locale),
  );
  if (!response.ok) {
    throw new Error("COLLECTION_DETAIL_MIRROR_FAILED");
  }

  const payload = (await response.json()) as CollectionDetailResponse;
  if (!payload.collection) {
    return;
  }

  await putCollectionDetail(collectionId, locale, updatedAt, payload);

  const entries = await fetchAllEntriesPages(collectionId, locale);
  await putCollectionEntries(
    collectionId,
    locale,
    entries.items,
    entries.total,
    entries.totalValue,
  );
}

async function needsDetailMirror(
  item: CollectionSummary,
  locale: UiLocale,
): Promise<boolean> {
  const stored = await getStoredCollectionDetailStore(item.id, locale);
  if (!stored) {
    return true;
  }

  return (
    new Date(item.updatedAt).getTime() > new Date(stored.updatedAt).getTime()
  );
}

async function runMirror(locale: UiLocale, collectionIds?: string[]): Promise<void> {
  const response = await fetch(apiUrl("/api/collections", locale));
  if (!response.ok) {
    throw new Error("COLLECTIONS_MIRROR_FAILED");
  }

  const payload = (await response.json()) as { items?: CollectionSummary[] };
  const items = payload.items ?? [];
  await putCollections(items);
  await deleteCollectionsExcept(new Set(items.map((item) => item.id)));

  const itemById = new Map(items.map((item) => [item.id, item]));
  const idsToMirror =
    collectionIds ??
    (
      await Promise.all(
        items.map(async (item) =>
          (await needsDetailMirror(item, locale)) ? item.id : null,
        ),
      )
    ).filter((id): id is string => id != null);

  await mapWithConcurrency(idsToMirror, COLLECTION_MIRROR_CONCURRENCY, (id) => {
    const item = itemById.get(id);
    if (!item) {
      return Promise.resolve();
    }
    return mirrorCollectionDetail(id, locale, item.updatedAt);
  });

  if (collectionIds) {
    const currentIds = new Set(items.map((item) => item.id));
    for (const id of collectionIds) {
      if (!currentIds.has(id)) {
        await deleteCollectionData(id, locale);
      }
    }
  }

  await setOfflineMeta({
    locale,
    lastFullSyncAt: new Date().toISOString(),
  });

  await prefetchCollectionShells(items.map((item) => item.id));
}

export async function syncMirror(locale: UiLocale): Promise<void> {
  if (typeof window === "undefined" || !getIsOnline()) {
    return;
  }

  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      await runMirror(locale);
    } catch (error) {
      if (!isFetchNetworkError(error)) {
        console.error("[offline-mirror]", error);
      }
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

export function scheduleCollectionMirror(
  collectionId: string,
  locale: UiLocale,
): void {
  if (typeof window === "undefined" || !getIsOnline()) {
    return;
  }

  void (async () => {
    try {
      const listResponse = await fetch(apiUrl("/api/collections", locale));
      if (!listResponse.ok) {
        return;
      }
      const listPayload = (await listResponse.json()) as {
        items?: CollectionSummary[];
      };
      const items = listPayload.items ?? [];
      await putCollections(items);

      const item = items.find((entry) => entry.id === collectionId);
      if (!item) {
        await deleteCollectionData(collectionId, locale);
        return;
      }

      await mirrorCollectionDetail(collectionId, locale, item.updatedAt);
      await setOfflineMeta({
        locale,
        lastFullSyncAt: new Date().toISOString(),
      });
      await prefetchCollectionShells([collectionId]);
    } catch (error) {
      if (!isFetchNetworkError(error)) {
        console.error("[offline-mirror collection]", error);
      }
    }
  })();
}

export function scheduleFullMirror(locale: UiLocale): void {
  void syncMirror(locale);
}
