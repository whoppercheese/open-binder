import type { UiLocale } from "@/lib/i18n/locale";
import { getLocalizedString } from "@/lib/catalog-languages";
import { listCollections } from "@/lib/collections.server";

type SetWithCounts = {
  id: string;
  cardCountOfficial: number;
  cardCountTotal: number;
};

export type SetProgress = {
  owned: number;
  total: number;
  percent: number;
  hasCollection: boolean;
};

export async function buildSetProgressMap(
  locale: UiLocale,
  allSets: readonly SetWithCounts[],
): Promise<Map<string, SetProgress>> {
  const allCollections = await listCollections(locale);
  const progressBySet = new Map<string, SetProgress>();

  for (const col of allCollections) {
    if (col.type !== "set" || !col.setId) {
      continue;
    }
    if (!progressBySet.has(col.setId)) {
      progressBySet.set(col.setId, {
        owned: col.ownedCount,
        total: col.totalCount,
        percent: col.percent,
        hasCollection: true,
      });
    }
  }

  return new Map(
    allSets.map((set) => [
      set.id,
      progressBySet.get(set.id) ?? {
        owned: 0,
        total: set.cardCountOfficial || set.cardCountTotal,
        percent: 0,
        hasCollection: false,
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
