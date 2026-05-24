export const UI_LOCALES = ["en", "de"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_LOCALE: UiLocale = "en";

export function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}

export function localeToIntlTag(locale: UiLocale): string {
  switch (locale) {
    case "de":
      return "de-DE";
    case "en":
    default:
      return "en-US";
  }
}

export function cardmarketLocalePath(locale: UiLocale): "de" | "en" {
  return locale === "de" ? "de" : "en";
}
