import Link from "next/link";
import { ArrowRight, RefreshCw, TrendingUp } from "lucide-react";
import { CardImage } from "@/components/card-image";
import { SetListItem } from "@/components/set-list-item";
import { getPortfolioSummary } from "@/lib/portfolio";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const summary = await getPortfolioSummary();
  const topSets = summary.setProgress
    .filter((set) => set.owned > 0)
    .slice(0, 6);

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-xs text-zinc-500">
          Inoffizielles Fan-Tool · Cardmarket EUR
        </p>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
        <div className="mb-2 flex items-center gap-2 text-emerald-400">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-medium">Portfolio-Wert</span>
        </div>
        <p className="text-3xl font-bold text-white">
          {formatCurrency(summary.totalValue)}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {summary.totalCards} Karten · {summary.uniqueEntries} Einträge
          {summary.cardsWithPrice < summary.totalCards
            ? ` · ${summary.totalCards - summary.cardsWithPrice} ohne Preis`
            : ""}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Set-Fortschritt</h2>
          <Link href="/sets" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            Alle Sets
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {topSets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            Noch keine Karten in der Sammlung. Starte mit einem Set oder der
            Suche.
          </div>
        ) : (
          topSets.map((set) => (
            <SetListItem
              key={set.setId}
              id={set.setId}
              nameDe={set.setName}
              owned={set.owned}
              total={set.total}
              percent={set.percent}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zuletzt hinzugefügt</h2>
          <Link href="/collection" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            Sammlung
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {summary.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch keine Einträge.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {summary.recent.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="relative aspect-card w-full">
                  <CardImage
                    cardId={item.cardId}
                    setId={item.setId}
                    number={item.number}
                    alt={item.cardName}
                    className="h-full w-full"
                  />
                </div>
                <p className="truncate text-[10px] text-zinc-400">
                  {item.cardName}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
        <div className="mb-2 flex items-center gap-2 text-white">
          <RefreshCw className="h-4 w-4" />
          Sync-Status
        </div>
        <p>
          Katalog:{" "}
          {summary.sync.catalog
            ? `${summary.sync.catalog.status} · ${formatDate(summary.sync.catalog.finishedAt ?? summary.sync.catalog.createdAt)}`
            : "Noch kein Sync"}
        </p>
        <p>
          Preise:{" "}
          {summary.sync.prices
            ? `${summary.sync.prices.status} · ${formatDate(summary.sync.prices.finishedAt ?? summary.sync.prices.createdAt)}`
            : "Noch kein Sync"}
        </p>
        <Link
          href="/settings"
          className="mt-3 inline-block text-emerald-400"
        >
          Sync in Einstellungen starten
        </Link>
      </section>
    </div>
  );
}
