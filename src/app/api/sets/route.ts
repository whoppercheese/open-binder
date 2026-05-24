import { desc, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getRequestTranslator } from "@/lib/i18n/server";
import { buildSetProgressMap } from "@/lib/set-progress.server";
import { supportedCatalogSetsWhere } from "@/lib/sets-list-catalog";
import { groupSetsBySeries, sortSetsForDisplay } from "@/lib/sets-list-sort";

export async function GET(request: Request) {
  try {
    const { locale, t } = getRequestTranslator(request);
    const allSets = await db.query.sets.findMany({
      where: supportedCatalogSetsWhere(),
      orderBy: [desc(sets.releaseDate)],
    });

    const progressBySet = await buildSetProgressMap(locale, allSets);

    const entries = allSets.map((set) => {
        const progress = progressBySet.get(set.id) ?? {
          owned: 0,
          total: set.cardCountOfficial || set.cardCountTotal,
          percent: 0,
        };

        return {
          ...set,
          seriesName:
            getLocalizedString(set.seriesNames, locale) || t("sets.seriesOther"),
          cardsSyncedAt: set.cardsSyncedAt?.toISOString() ?? null,
          progress,
        };
      });

    const groupedEntries = groupSetsBySeries(
      sortSetsForDisplay(entries),
      t("sets.seriesOther"),
    );

    const grouped = Object.fromEntries(
      groupedEntries.map(([series, seriesSets]) => [series, seriesSets]),
    );

    return NextResponse.json({ series: grouped, totalSets: entries.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SETS_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
