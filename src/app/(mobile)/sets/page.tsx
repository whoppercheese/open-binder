import { asc } from "drizzle-orm";
import { SetsPageContent } from "@/app/(mobile)/sets/sets-page-content";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";

export default async function SetsPage() {
  const allSets = await db.query.sets.findMany({
    orderBy: [asc(sets.releaseDate)],
  });
  const summary = await getPortfolioSummary();
  const progressBySet = new Map(
    summary.setProgress.map((item) => [item.setId, item]),
  );

  const setEntries = allSets.map((set) => {
    const progress = progressBySet.get(set.id) ?? {
      owned: 0,
      total: set.cardCountTotal,
      percent: 0,
    };

    return {
      id: set.id,
      nameDe: set.nameDe,
      officialCode: set.officialCode,
      seriesName: set.seriesName,
      progress: {
        owned: progress.owned,
        total: progress.total,
        percent: progress.percent,
      },
    };
  });

  return <SetsPageContent sets={setEntries} />;
}
