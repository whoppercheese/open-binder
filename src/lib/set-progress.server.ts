import type { UiLocale } from "@/lib/i18n/locale";
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
