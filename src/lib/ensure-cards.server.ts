import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, sets } from "@/db/schema";
import { extractSetIdFromCardId } from "@/lib/card-id";
import { syncSingleCard } from "@/lib/catalog-card-sync.server";
import type { UiLocale } from "@/lib/i18n/locale";
import { ensureSetMetadata } from "@/lib/set-metadata.server";
import { getUiLanguage } from "@/lib/settings";

const ENSURE_CONCURRENCY = 3;

export type EnsureCardsResult = {
  synced: string[];
  failed: Array<{ cardId: string; error: string }>;
};

async function resolveSeriesId(setId: string): Promise<string> {
  const row = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
    columns: { seriesId: true },
  });
  return row?.seriesId ?? "unknown";
}

async function ensureOneCard(
  cardId: string,
  catalogLang: UiLocale,
): Promise<void> {
  const setId = extractSetIdFromCardId(cardId);
  const ensured = await ensureSetMetadata(setId);
  if (!ensured) {
    throw new Error(`Set metadata unavailable for ${setId}`);
  }

  const seriesId = await resolveSeriesId(setId);
  await syncSingleCard(cardId, seriesId, setId, catalogLang);
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

export async function ensureCardsInCatalog(
  cardIds: readonly string[],
  locale?: UiLocale,
): Promise<EnsureCardsResult> {
  const uniqueIds = [...new Set(cardIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { synced: [], failed: [] };
  }

  const existingRows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(inArray(cards.id, uniqueIds));

  const existingIds = new Set(existingRows.map((row) => row.id));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
  const synced = uniqueIds.filter((id) => existingIds.has(id));
  const failed: EnsureCardsResult["failed"] = [];

  if (missingIds.length === 0) {
    return { synced: uniqueIds, failed };
  }

  const catalogLang = locale ?? (await getUiLanguage());

  await mapWithConcurrency(missingIds, ENSURE_CONCURRENCY, async (cardId) => {
    try {
      await ensureOneCard(cardId, catalogLang);
      synced.push(cardId);
    } catch (error) {
      failed.push({
        cardId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return { synced, failed };
}
