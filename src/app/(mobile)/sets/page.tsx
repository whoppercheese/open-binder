import { asc } from "drizzle-orm";
import { SetListItem } from "@/components/set-list-item";
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

  const grouped = allSets.reduce<
    Record<string, typeof allSets>
  >((acc, set) => {
    const series = set.seriesName || "Sonstige";
    acc[series] ??= [];
    acc[series].push(set);
    return acc;
  }, {});

  return (
    <div className="space-y-6 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Sets</h1>
        <p className="text-sm text-zinc-400">
          {allSets.length} Sets durchsuchen
        </p>
      </header>

      {Object.entries(grouped).map(([series, seriesSets]) => (
        <section key={series} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {series}
          </h2>
          <div className="space-y-3">
            {seriesSets.map((set) => {
              const progress = progressBySet.get(set.id) ?? {
                owned: 0,
                total: set.cardCountTotal,
                percent: 0,
              };
              return (
                <SetListItem
                  key={set.id}
                  id={set.id}
                  nameDe={set.nameDe}
                  officialCode={set.officialCode}
                  owned={progress.owned}
                  total={progress.total}
                  percent={progress.percent}
                />
              );
            })}
          </div>
        </section>
      ))}

      {allSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Noch kein Katalog vorhanden. Starte den Katalog-Sync in den
          Einstellungen.
        </div>
      ) : null}
    </div>
  );
}
