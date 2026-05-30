import { getLocalizedString } from "@/lib/catalog-languages";
import type { UiLocale } from "@/lib/i18n/locale";

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
