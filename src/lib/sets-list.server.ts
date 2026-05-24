import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPortfolioSummary } from "@/lib/portfolio";
import type { SetListEntry } from "@/lib/sets-list";

export async function getSetListEntries(): Promise<SetListEntry[]> {
  const locale = await getRequestLocale();
  const allSets = await db.query.sets.findMany({
    orderBy: [asc(sets.releaseDate)],
  });
  const summary = await getPortfolioSummary(locale);
  const progressBySet = new Map(
    summary.setProgress.map((item) => [item.setId, item]),
  );

  return allSets.map((set) => {
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
}
