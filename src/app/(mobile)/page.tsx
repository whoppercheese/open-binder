import Link from "next/link";
import { ArrowRight, RefreshCw, TrendingUp } from "lucide-react";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { SetListItem } from "@/components/set-list-item";
import { getServerTranslator } from "@/lib/i18n/server";
import { getPortfolioSummary } from "@/lib/portfolio";
import { formatJobStatusLabel } from "@/lib/sync-job-display";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const { locale, t } = await getServerTranslator();
  const summary = await getPortfolioSummary(locale);
  const topSets = summary.setProgress
    .filter((set) => set.owned > 0)
    .slice(0, 6);

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">{t("dashboard.title")}</h1>
        <p className="text-xs text-zinc-500">{t("dashboard.subtitle")}</p>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
        <div className="mb-2 flex items-center gap-2 text-emerald-400">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-medium">{t("dashboard.portfolioValue")}</span>
        </div>
        <p className="text-3xl font-bold text-white">
          {formatCurrency(summary.totalValue, "EUR", locale)}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {t("dashboard.cardsSummary", {
            cards: summary.totalCards,
            entries: summary.uniqueEntries,
          })}
          {summary.cardsWithPrice < summary.totalCards
            ? t("dashboard.cardsWithoutPriceSuffix", {
                count: summary.totalCards - summary.cardsWithPrice,
              })
            : ""}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.setProgress")}</h2>
          <Link href="/sets" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            {t("dashboard.allSets")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {topSets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            {t("dashboard.emptyCollection")}
          </div>
        ) : (
          topSets.map((set) => (
            <SetListItem
              key={set.setId}
              id={set.setId}
              name={set.setName}
              cardsSynced
              owned={set.owned}
              total={set.total}
              percent={set.percent}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.recentlyAdded")}</h2>
          <Link href="/collection" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            {t("dashboard.collectionLink")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {summary.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("dashboard.noEntries")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {summary.recent.map((item) => (
              <div key={item.cardId} className="space-y-1">
                <CardFrame className="aspect-card w-full">
                  <CardImage
                    cardId={item.cardId}
                    setId={item.setId}
                    number={item.number}
                    alt={item.cardName}
                    className="h-full w-full"
                  />
                </CardFrame>
                <p className="truncate text-[10px] font-medium text-zinc-300">
                  {item.cardName}
                </p>
                <p className="truncate text-[10px] tabular-nums text-zinc-500">
                  {item.officialCode ?? item.setId} · #{item.number}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
        <div className="mb-2 flex items-center gap-2 text-white">
          <RefreshCw className="h-4 w-4" />
          {t("dashboard.syncStatus")}
        </div>
        <p>
          {t("dashboard.setsLabel")}{" "}
          {summary.sync.catalog
            ? `${formatJobStatusLabel(summary.sync.catalog.status, summary.sync.catalog.message, t)} · ${formatDate(summary.sync.catalog.finishedAt ?? summary.sync.catalog.createdAt, locale)}`
            : t("dashboard.noSyncYet")}
        </p>
        <p>
          {t("dashboard.pricesLabel")}{" "}
          {summary.sync.prices
            ? `${formatJobStatusLabel(summary.sync.prices.status, summary.sync.prices.message, t)} · ${formatDate(summary.sync.prices.finishedAt ?? summary.sync.prices.createdAt, locale)}`
            : t("dashboard.noSyncYet")}
        </p>
        <Link
          href="/settings"
          className="mt-3 inline-block text-emerald-400"
        >
          {t("dashboard.startSyncInSettings")}
        </Link>
      </section>
    </div>
  );
}
