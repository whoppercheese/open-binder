import { sql } from "drizzle-orm";
import { cards, sets } from "@/db/schema";
import { getLocalizedString, type LocalizedStrings } from "@/lib/catalog-languages";
import type { UiLocale } from "@/lib/i18n/locale";

export const UNKNOWN_LABEL = "Unknown";

export function localizedJsonbSql(
  column: typeof cards.names | typeof sets.names | typeof sets.seriesNames,
  locale: UiLocale,
): ReturnType<typeof sql<string>> {
  return sql<string>`coalesce(${column}->>${locale}, ${column}->>'en', ${UNKNOWN_LABEL})`;
}

export function localizedCardNameSql(locale: UiLocale) {
  return localizedJsonbSql(cards.names, locale);
}

export function localizedSetNameSql(locale: UiLocale) {
  return localizedJsonbSql(sets.names, locale);
}

export function localizedSeriesNameSql(locale: UiLocale) {
  return localizedJsonbSql(sets.seriesNames, locale);
}

export function getLocalizedName(
  map: LocalizedStrings | null | undefined,
  locale: UiLocale,
): string {
  return getLocalizedString(map, locale) ?? UNKNOWN_LABEL;
}
