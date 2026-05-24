import type { UiLocale } from "@/lib/i18n/locale";
import { localeToIntlTag } from "@/lib/i18n/locale";
import en from "@/messages/en.json";
import de from "@/messages/de.json";

export type MessageCatalog = Record<string, unknown>;

const catalogs: Record<UiLocale, MessageCatalog> = { en, de };

export type PluralForms = {
  one: string;
  other: string;
};

export type TranslateFn = ((
  key: string,
  params?: Record<string, string | number>,
) => string) & {
  plural: PluralTranslateFn;
};

export type PluralTranslateFn = (
  key: string,
  count: number,
  params?: Record<string, string | number>,
) => string;

function lookupValue(catalog: MessageCatalog, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function lookup(catalog: MessageCatalog, key: string): string | undefined {
  const value = lookupValue(catalog, key);
  return typeof value === "string" ? value : undefined;
}

function lookupPlural(
  catalog: MessageCatalog,
  key: string,
): PluralForms | undefined {
  const value = lookupValue(catalog, key);
  if (value == null || typeof value !== "object") return undefined;
  const forms = value as Record<string, unknown>;
  if (typeof forms.one !== "string" || typeof forms.other !== "string") {
    return undefined;
  }
  return { one: forms.one, other: forms.other };
}

function selectPluralForm(locale: UiLocale, count: number): keyof PluralForms {
  const category = new Intl.PluralRules(localeToIntlTag(locale)).select(count);
  return category === "one" ? "one" : "other";
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
  const translate = (key: string, params?: Record<string, string | number>) => {
    const value =
      lookup(catalogs[locale], key) ?? lookup(catalogs.en, key);
    if (value == null) {
      const enFallback = lookup(catalogs.en, key);
      return enFallback ?? key;
    }
    return interpolate(value, params);
  };

  const plural: PluralTranslateFn = (key, count, params) => {
    const forms =
      lookupPlural(catalogs[locale], key) ??
      lookupPlural(catalogs.en, key);
    if (forms == null) return key;
    const template = forms[selectPluralForm(locale, count)];
    return interpolate(template, { ...params, count });
  };

  return Object.assign(translate, { plural });
}

export function getMessages(locale: UiLocale): MessageCatalog {
  return catalogs[locale];
}

/** Prefer plural forms when params include count or skipped. */
export function resolveTranslation(
  t: TranslateFn,
  key: string,
  params?: Record<string, string | number>,
): string {
  if (params) {
    const pluralCount =
      params.count != null
        ? Number(params.count)
        : params.skipped != null
          ? Number(params.skipped)
          : null;
    if (pluralCount != null) {
      const pluralText = t.plural(key, pluralCount, {
        ...params,
        count: params.count ?? params.skipped,
      });
      if (pluralText !== key) return pluralText;
    }
  }
  return t(key, params);
}
