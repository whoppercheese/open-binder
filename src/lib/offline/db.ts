import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CardDetail } from "@/components/card-modal";
import type { UiLocale } from "@/lib/i18n/locale";
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_SCHEMA_VERSION,
  type CardDetailStore,
  type CollectionDetailStore,
  type CollectionEntriesStore,
  type CollectionEntryItem,
  type CollectionSummary,
  type OfflineMeta,
  cardDetailKey,
  collectionDetailKey,
  collectionEntriesKey,
} from "@/lib/offline/types";

interface OfflineDbSchema extends DBSchema {
  meta: {
    key: string;
    value: OfflineMeta;
  };
  collections: {
    key: string;
    value: CollectionSummary;
  };
  collectionDetails: {
    key: string;
    value: CollectionDetailStore;
  };
  collectionEntries: {
    key: string;
    value: CollectionEntriesStore;
  };
  cardDetails: {
    key: string;
    value: CardDetailStore;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("collections")) {
          db.createObjectStore("collections", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("collectionDetails")) {
          db.createObjectStore("collectionDetails", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("collectionEntries")) {
          db.createObjectStore("collectionEntries", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("cardDetails")) {
          db.createObjectStore("cardDetails", { keyPath: "key" });
        }

        // v1 meta store had no keyPath; recreate with keyPath on upgrade.
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains("meta")) {
            db.deleteObjectStore("meta");
          }
          db.createObjectStore("meta", { keyPath: "id" });
        } else if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

export async function getOfflineMeta(): Promise<OfflineMeta | null> {
  const db = await getDb();
  return (await db.get("meta", "meta")) ?? null;
}

export async function setOfflineMeta(
  partial: Partial<Omit<OfflineMeta, "id">>,
): Promise<void> {
  const db = await getDb();
  const existing = await getOfflineMeta();
  await db.put("meta", {
    id: "meta",
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    lastFullSyncAt: partial.lastFullSyncAt ?? existing?.lastFullSyncAt ?? null,
    locale: partial.locale ?? existing?.locale ?? "en",
  });
}

export async function getAllCollections(): Promise<CollectionSummary[]> {
  const db = await getDb();
  return db.getAll("collections");
}

export async function putCollections(items: CollectionSummary[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("collections", "readwrite");
  await Promise.all([...items.map((item) => tx.store.put(item)), tx.done]);
}

export async function deleteCollectionsExcept(ids: Set<string>): Promise<void> {
  const db = await getDb();
  const existing = await db.getAllKeys("collections");
  const tx = db.transaction("collections", "readwrite");
  for (const id of existing) {
    if (!ids.has(id)) {
      await tx.store.delete(id);
    }
  }
  await tx.done;
}

export async function getStoredCollectionDetailStore(
  collectionId: string,
  locale: UiLocale,
): Promise<CollectionDetailStore | null> {
  const db = await getDb();
  const key = collectionDetailKey(collectionId, locale);
  return (await db.get("collectionDetails", key)) ?? null;
}

export async function getStoredCollectionDetail(
  collectionId: string,
  locale: UiLocale,
) {
  const db = await getDb();
  const key = collectionDetailKey(collectionId, locale);
  return (await db.get("collectionDetails", key))?.data ?? null;
}

export async function putCollectionDetail(
  collectionId: string,
  locale: UiLocale,
  updatedAt: string,
  data: CollectionDetailStore["data"],
): Promise<void> {
  const db = await getDb();
  await db.put("collectionDetails", {
    key: collectionDetailKey(collectionId, locale),
    collectionId,
    locale,
    updatedAt,
    data,
  });
}

export async function deleteCollectionDetail(
  collectionId: string,
  locale: UiLocale,
): Promise<void> {
  const db = await getDb();
  await db.delete(
    "collectionDetails",
    collectionDetailKey(collectionId, locale),
  );
}

export async function getCollectionEntriesStore(
  collectionId: string,
  locale: UiLocale,
): Promise<CollectionEntriesStore | null> {
  const db = await getDb();
  return (
    (await db.get(
      "collectionEntries",
      collectionEntriesKey(collectionId, locale),
    )) ?? null
  );
}

export async function putCollectionEntries(
  collectionId: string,
  locale: UiLocale,
  items: CollectionEntryItem[],
  total: number,
  totalValue: number,
): Promise<void> {
  const db = await getDb();
  await db.put("collectionEntries", {
    key: collectionEntriesKey(collectionId, locale),
    collectionId,
    locale,
    items,
    total,
    totalValue,
    syncedAt: new Date().toISOString(),
  });
}

export async function deleteCollectionEntries(
  collectionId: string,
  locale: UiLocale,
): Promise<void> {
  const db = await getDb();
  await db.delete(
    "collectionEntries",
    collectionEntriesKey(collectionId, locale),
  );
}

export async function putCardDetail(
  cardId: string,
  collectionId: string,
  locale: UiLocale,
  data: CardDetail,
): Promise<void> {
  const db = await getDb();
  await db.put("cardDetails", {
    key: cardDetailKey(cardId, collectionId, locale),
    cardId,
    collectionId,
    locale,
    data,
  });
}

export async function getStoredCardDetail(
  cardId: string,
  collectionId: string,
  locale: UiLocale,
) {
  const db = await getDb();
  const key = cardDetailKey(cardId, collectionId, locale);
  return (await db.get("cardDetails", key))?.data ?? null;
}

export async function deleteCollectionData(
  collectionId: string,
  locale: UiLocale,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["collections", "collectionDetails", "collectionEntries", "cardDetails"],
    "readwrite",
  );

  await tx.objectStore("collections").delete(collectionId);
  await tx
    .objectStore("collectionDetails")
    .delete(collectionDetailKey(collectionId, locale));
  await tx
    .objectStore("collectionEntries")
    .delete(collectionEntriesKey(collectionId, locale));

  const cardKeys = await tx.objectStore("cardDetails").getAllKeys();
  for (const key of cardKeys) {
    if (key.endsWith(`:${collectionId}:${locale}`)) {
      await tx.objectStore("cardDetails").delete(key);
    }
  }

  await tx.done;
}

export async function clearOfflineCache(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    [
      "meta",
      "collections",
      "collectionDetails",
      "collectionEntries",
      "cardDetails",
    ],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("meta").clear(),
    tx.objectStore("collections").clear(),
    tx.objectStore("collectionDetails").clear(),
    tx.objectStore("collectionEntries").clear(),
    tx.objectStore("cardDetails").clear(),
    tx.done,
  ]);
}

export async function clearAllOfflineData(): Promise<void> {
  await clearOfflineCache();
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("openbinder"))
        .map((key) => caches.delete(key)),
    );
  }
}

export async function getOfflineCacheStats(): Promise<{
  collectionCount: number;
  lastFullSyncAt: string | null;
}> {
  try {
    const [collections, meta] = await Promise.all([
      getAllCollections(),
      getOfflineMeta(),
    ]);
    return {
      collectionCount: collections.length,
      lastFullSyncAt: meta?.lastFullSyncAt ?? null,
    };
  } catch {
    return { collectionCount: 0, lastFullSyncAt: null };
  }
}

export async function hasOfflineData(): Promise<boolean> {
  try {
    const collections = await getAllCollections();
    return collections.length > 0;
  } catch {
    return false;
  }
}
