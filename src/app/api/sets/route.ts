import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getPortfolioSummary } from "@/lib/portfolio";

export async function GET() {
  try {
    const allSets = await db.query.sets.findMany({
      orderBy: [asc(sets.releaseDate)],
    });

    const summary = await getPortfolioSummary();
    const progressBySet = new Map(
      summary.setProgress.map((item) => [item.setId, item]),
    );

    const grouped = allSets.reduce<
      Record<string, Array<(typeof allSets)[number] & { progress: { owned: number; total: number; percent: number } }>>
    >((acc, set) => {
      const series = set.seriesName || "Sonstige";
      const progress = progressBySet.get(set.id) ?? {
        owned: 0,
        total: set.cardCountTotal,
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
      { error: "Sets konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
