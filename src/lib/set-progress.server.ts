import type { UiLocale } from "@/lib/i18n/locale";
import { getLocalizedString } from "@/lib/catalog-languages";
import { getPortfolioSummary } from "@/lib/portfolio";

type SetWithCounts = {
  id: string;
  cardCountOfficial: number;
  cardCountTotal: number;
};

export type SetProgress = {
  owned: number;
  total: number;
  percent: number;
};

export async function buildSetProgressMap(
  locale: UiLocale,
  allSets: readonly SetWithCounts[],
): Promise<Map<string, SetProgress>> {
  const summary = await getPortfolioSummary(locale);
  const progressBySet = new Map(
    summary.setProgress.map((item) => [item.setId, item]),
  );

  return new Map(
    allSets.map((set) => [
      set.id,
      progressBySet.get(set.id) ?? {
        owned: 0,
        total: set.cardCountOfficial || set.cardCountTotal,
        percent: 0,
      },
    ]),
  );
}

export function resolveSetDisplayNames(
  setRows: ReadonlyArray<{
    id: string;
    names: Record<string, string> | null;
  }>,
  locale: UiLocale,
): Map<string, string> {
  return new Map(
    setRows.map((set) => [
      set.id,
      getLocalizedString(set.names, locale) ?? set.id,
    ]),
  );
}
