import type { UiLocale } from "@/lib/i18n/locale";
import en from "@/messages/en.json";
import de from "@/messages/de.json";

export type MessageCatalog = Record<string, unknown>;

const catalogs: Record<UiLocale, MessageCatalog> = { en, de };

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function lookup(catalog: MessageCatalog, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] != null ? String(params[name]) : `{${name}}`,
  );
}

export function createTranslator(locale: UiLocale): TranslateFn {
  return (key, params) => {
    const value =
      lookup(catalogs[locale], key) ?? lookup(catalogs.en, key);
    if (value == null) {
      const enFallback = lookup(catalogs.en, key);
      return enFallback ?? key;
    }
    return interpolate(value, params);
  };
}

export function getMessages(locale: UiLocale): MessageCatalog {
  return catalogs[locale];
}
