import type { SupportedLanguages } from "@tcgdex/sdk";
import type { UiLocale } from "@/lib/i18n/locale";

export const TCGDEX_CATALOG_LANGUAGES = [
  "en",
  "fr",
  "es",
  "es-mx",
  "it",
  "pt",
  "pt-br",
  "de",
  "nl",
  "pl",
  "ru",
  "ja",
  "ko",
  "zh-tw",
  "id",
  "th",
  "zh-cn",
] as const satisfies readonly SupportedLanguages[];

export type TcgdexLanguage = (typeof TCGDEX_CATALOG_LANGUAGES)[number];

export type LocalizedStrings = Partial<Record<TcgdexLanguage, string>>;

export function mergeLocalized(
  existing: LocalizedStrings,
  incoming: LocalizedStrings,
): LocalizedStrings {
  return { ...existing, ...incoming };
}

export function getLocalizedString(
  map: LocalizedStrings | null | undefined,
  locale: UiLocale | TcgdexLanguage,
): string | null {
  if (!map) return null;
  const preferred = map[locale as TcgdexLanguage];
  if (preferred?.trim()) return preferred.trim();
  const en = map.en;
  if (en?.trim()) return en.trim();
  return null;
}

export const TS_CONFIG: Record<UiLocale, string> = {
  en: "english",
  de: "german",
};
