import "server-only";

import { desc, count } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getRequestLocale } from "@/lib/i18n/server";
import { buildSetProgressMap } from "@/lib/set-progress.server";
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
  const progressBySet = await buildSetProgressMap(locale, allSets);

  const entries = allSets.map((set) => {
    const cardsSynced = set.cardsSyncedAt != null;
    const progress = cardsSynced
      ? (progressBySet.get(set.id) ?? {
          owned: 0,
          total: set.cardCountOfficial || set.cardCountTotal,
          percent: 0,
        })
      : null;

    return {
      id: set.id,
      name: getLocalizedString(set.names, locale) ?? set.id,
      officialCode: set.officialCode,
      seriesName: getLocalizedString(set.seriesNames, locale) ?? "",
      releaseDate: set.releaseDate,
      cardsSyncedAt: set.cardsSyncedAt?.toISOString() ?? null,
      progress: progress
        ? {
            owned: progress.owned,
            total: progress.total,
            percent: progress.percent,
          }
        : null,
    };
  });

  return sortSetsForDisplay(entries);
}
