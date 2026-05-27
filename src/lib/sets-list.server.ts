import "server-only";

import { desc, count } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getRequestLocale } from "@/lib/i18n/server";
import { buildSetHasCollectionIds } from "@/lib/set-progress.server";
import { supportedCatalogSetsWhere } from "@/lib/sets-list-catalog";
import { sortSetsForDisplay } from "@/lib/sets-list-sort";
import type { SetListEntry } from "@/lib/sets-list";

export async function getSupportedCatalogSetCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(sets)
    .where(supportedCatalogSetsWhere());

  return row?.count ?? 0;
}

export async function getSetListEntries(): Promise<SetListEntry[]> {
  const locale = await getRequestLocale();
  const allSets = await db.query.sets.findMany({
    where: supportedCatalogSetsWhere(),
    orderBy: [desc(sets.releaseDate)],
  });
  const setIdsWithCollection = await buildSetHasCollectionIds(locale);

  const entries = allSets.map((set) => ({
    id: set.id,
    name: getLocalizedString(set.names, locale) ?? set.id,
    officialCode: set.officialCode,
    seriesName: getLocalizedString(set.seriesNames, locale) ?? "",
    releaseDate: set.releaseDate,
    cardsSyncedAt: set.cardsSyncedAt?.toISOString() ?? null,
    cardCount: set.cardCountOfficial || set.cardCountTotal,
    hasCollection: setIdsWithCollection.has(set.id),
  }));

  return sortSetsForDisplay(entries);
}
