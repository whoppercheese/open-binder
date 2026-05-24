import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getRequestTranslator } from "@/lib/i18n/server";
import { buildSetProgressMap } from "@/lib/set-progress.server";

export async function GET(request: Request) {
  try {
    const { locale, t } = getRequestTranslator(request);
    const allSets = await db.query.sets.findMany({
      orderBy: [asc(sets.releaseDate)],
    });

    const progressBySet = await buildSetProgressMap(locale, allSets);

    const grouped = allSets.reduce<
      Record<
        string,
        Array<
          (typeof allSets)[number] & {
            progress: { owned: number; total: number; percent: number };
          }
        >
      >
    >((acc, set) => {
      const series =
        getLocalizedString(set.seriesNames, locale) || t("sets.seriesOther");
      const progress = progressBySet.get(set.id) ?? {
        owned: 0,
        total: set.cardCountOfficial || set.cardCountTotal,
        percent: 0,
      };
      acc[series] ??= [];
      acc[series].push({ ...set, progress });
      return acc;
    }, {});

    return NextResponse.json({ series: grouped, totalSets: allSets.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SETS_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
