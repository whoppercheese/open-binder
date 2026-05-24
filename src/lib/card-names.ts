import { localizedCardNameSql, getLocalizedName } from "@/lib/localized-names";
import type { UiLocale } from "@/lib/i18n/locale";
import type { LocalizedStrings } from "@/lib/catalog-languages";

export { localizedCardNameSql as cardDisplayNameSql };

export function getCardDisplayName(
  card: { names: LocalizedStrings | Record<string, string> | null | undefined },
  locale: UiLocale = "en",
): string {
  return getLocalizedName(card.names, locale);
}
