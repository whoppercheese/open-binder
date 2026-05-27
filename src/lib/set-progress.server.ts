import type { UiLocale } from "@/lib/i18n/locale";
import { getLocalizedString } from "@/lib/catalog-languages";
import { listCollections } from "@/lib/collections.server";

export async function buildSetHasCollectionIds(
  locale: UiLocale,
): Promise<Set<string>> {
  const allCollections = await listCollections(locale);
  const setIds = new Set<string>();

  for (const col of allCollections) {
    if (col.type === "set" && col.setId) {
      setIds.add(col.setId);
    }
  }

  return setIds;
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
