import { apiUrl } from "@/lib/i18n/context";
import type { UiLocale } from "@/lib/i18n/locale";
import type { CollectionEntryItem } from "@/lib/offline/types";

const ENTRIES_MIRROR_PAGE_SIZE = 100;

export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => runWorker(),
  );
  await Promise.all(workers);
}

export async function fetchAllEntriesPages(
  collectionId: string,
  locale: UiLocale,
): Promise<{ items: CollectionEntryItem[]; total: number }> {
  const allItems: CollectionEntryItem[] = [];
  let offset = 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      collectionId,
      limit: String(ENTRIES_MIRROR_PAGE_SIZE),
      offset: String(offset),
    });
    const response = await fetch(
      apiUrl(`/api/collection?${params.toString()}`, locale),
    );
    if (!response.ok) {
      throw new Error("COLLECTION_ENTRIES_FETCH_FAILED");
    }

    const payload = (await response.json()) as {
      items?: CollectionEntryItem[];
      total?: number;
      hasMore?: boolean;
    };

    const pageItems = payload.items ?? [];
    allItems.push(...pageItems);

    if (offset === 0) {
      total = payload.total ?? pageItems.length;
    }

    offset += pageItems.length;
    hasMore = Boolean(payload.hasMore) && pageItems.length > 0;
  }

  return { items: allItems, total };
}
