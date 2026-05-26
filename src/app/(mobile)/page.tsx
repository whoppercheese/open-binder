import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { CardGrid } from "@/components/card-grid";
import { CardTile } from "@/components/card-tile";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { CollectionListItem } from "@/components/collection-list-item";
import { getServerTranslator } from "@/lib/i18n/server";
import { getPortfolioSummary } from "@/lib/portfolio";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const { locale, t } = await getServerTranslator();
  const summary = await getPortfolioSummary(locale);
  const topCollections = summary.collections
    .filter((collection) => collection.totalCount > 0)
    .slice(0, 6);

  return (
    <MobilePage>
      <MobilePageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

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
            uniqueCardsPart: t.plural(
              "common.uniqueCardCount",
              summary.uniqueCards,
            ),
            copiesPart: t.plural("common.copyCount", summary.totalCards),
          })}
          {summary.cardsWithPrice < summary.totalCards
            ? t.plural(
                "dashboard.cardsWithoutPriceSuffix",
                summary.totalCards - summary.cardsWithPrice,
              )
            : ""}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.topCollections")}</h2>
          <Link href="/collections" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            {t("dashboard.allCollections")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {topCollections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            {t("dashboard.emptyCollection")}
          </div>
        ) : (
          topCollections.map((collection) => (
            <CollectionListItem
              key={collection.id}
              id={collection.id}
              name={collection.name}
              imageUrl={collection.imageUrl}
              coverImageUrl={collection.coverImageUrl}
              setId={collection.setId}
              setOfficialCode={collection.setOfficialCode}
              owned={collection.ownedCount}
              total={collection.totalCount}
              percent={collection.percent}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("dashboard.recentlyAdded")}</h2>
        {summary.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("dashboard.noEntries")}</p>
        ) : (
          <CardGrid>
            {summary.recent.map((item) => (
              <CardTile
                key={item.id}
                compact
                showPrice={false}
                href={`/collections/${item.collectionId}?view=entries&cardId=${encodeURIComponent(item.cardId)}`}
                card={{
                  id: item.cardId,
                  number: item.number,
                  name: item.cardName,
                  setId: item.setId,
                  imageUrl: item.imageUrl,
                  remoteImageUrl: item.imageUrl,
                  setName: item.setName,
                  officialCode: item.officialCode,
                  collectionName: item.collectionName,
                  ownedQuantity: item.quantity > 1 ? item.quantity : undefined,
                }}
              />
            ))}
          </CardGrid>
        )}
      </section>
    </MobilePage>
  );
}
