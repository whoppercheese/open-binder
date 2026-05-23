import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";
import type { SetListEntry } from "@/lib/sets-list";

export async function getSetListEntries(): Promise<SetListEntry[]> {
  const allSets = await db.query.sets.findMany({
    orderBy: [asc(sets.releaseDate)],
  });
  const summary = await getPortfolioSummary();
  const progressBySet = new Map(
    summary.setProgress.map((item) => [item.setId, item]),
  );

  return allSets.map((set) => {
    const cardsSynced = set.cardsSyncedAt != null;
    const progress = cardsSynced
      ? (progressBySet.get(set.id) ?? {
          owned: 0,
          total: set.cardCountTotal,
          percent: 0,
        })
      : null;

    return {
      id: set.id,
      nameDe: set.nameDe,
      officialCode: set.officialCode,
      seriesName: set.seriesName,
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
