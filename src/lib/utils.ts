import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { localeToIntlTag, type UiLocale } from "@/lib/i18n/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Must match --card-aspect-w / --card-aspect-h in globals.css */
export const CARD_ASPECT = {
  w: 2.5,
  h: 3.44,
} as const;

export function formatCurrency(
  value: number | string | null | undefined,
  currency = "EUR",
  locale: UiLocale = "en",
) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || Number.isNaN(num)) return "—";
  return new Intl.NumberFormat(localeToIntlTag(locale), {
    style: "currency",
    currency,
  }).format(num);
}

export function hasCardPrice(price: number | null | undefined): boolean {
  return price != null && !Number.isNaN(price);
}

/** Short set label: official TCG code when known, otherwise the TCGdex set id. */
export function resolveSetDisplayCode(options: {
  officialCode?: string | null;
  setId?: string | null;
}): string | null {
  const code = options.officialCode?.trim();
  if (code) {
    return code;
  }

  const setId = options.setId?.trim();
  return setId || null;
}

export function formatCardPriceLabel(
  price: number | null | undefined,
  label = "Price",
  locale: UiLocale = "en",
): string {
  return hasCardPrice(price)
    ? formatCurrency(price, "EUR", locale)
    : `${label}: —`;
}

export function formatCardPrice(
  price: number | null | undefined,
  locale: UiLocale = "en",
): string {
  return formatCardPriceLabel(price, "Price", locale);
}

/** TCGdex release dates are typically `YYYY/MM/DD` or ISO strings. */
export function getSetReleaseYear(
  releaseDate: string | null | undefined,
): string | null {
  if (!releaseDate) return null;

  const yearPrefix = releaseDate.match(/^(\d{4})/);
  if (yearPrefix) {
    return yearPrefix[1];
  }

  const parsed = new Date(releaseDate);
  if (!Number.isNaN(parsed.getTime())) {
    return String(parsed.getFullYear());
  }

  return null;
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: UiLocale = "en",
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(localeToIntlTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const VARIANT_LABELS: Record<string, string> = {
  normal: "Normal",
  holo: "Holo",
  reverse_holo: "Reverse Holo",
  first_edition: "1. Auflage",
};

export const CARD_CONDITIONS = ["mt", "nm", "ex", "gd", "lp", "pl", "po"] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number];

const LEGACY_CONDITION_MAP: Record<string, CardCondition> = {
  mint: "mt",
  mp: "pl",
  hp: "po",
};

export const CONDITION_LABELS: Record<CardCondition, string> = {
  mt: "MT",
  nm: "NM",
  ex: "EX",
  gd: "GD",
  lp: "LP",
  pl: "PL",
  po: "PO",
};

export const CONDITION_I18N_KEYS: Record<CardCondition, string> = {
  mt: "common.conditionMt",
  nm: "common.conditionNm",
  ex: "common.conditionEx",
  gd: "common.conditionGd",
  lp: "common.conditionLp",
  pl: "common.conditionPl",
  po: "common.conditionPo",
};

/** Tailwind classes per condition — green (MT) → red (PO), consistent app-wide. */
export const CONDITION_BADGE_STYLES: Record<
  CardCondition,
  { default: string; selected: string }
> = {
  mt: {
    default: "border-sky-500/35 bg-sky-500/15 text-sky-300",
    selected: "border-sky-400 bg-sky-500 text-black shadow-sm shadow-sky-500/25",
  },
  nm: {
    default: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
    selected: "border-emerald-400 bg-emerald-500 text-black shadow-sm shadow-emerald-500/25",
  },
  ex: {
    default: "border-lime-500/35 bg-lime-500/15 text-lime-300",
    selected: "border-lime-400 bg-lime-500 text-black shadow-sm shadow-lime-500/25",
  },
  gd: {
    default: "border-yellow-500/35 bg-yellow-500/15 text-yellow-300",
    selected: "border-yellow-400 bg-yellow-500 text-black shadow-sm shadow-yellow-500/25",
  },
  lp: {
    default: "border-amber-500/35 bg-amber-500/15 text-amber-300",
    selected: "border-amber-400 bg-amber-500 text-black shadow-sm shadow-amber-500/25",
  },
  pl: {
    default: "border-orange-500/35 bg-orange-500/15 text-orange-300",
    selected: "border-orange-400 bg-orange-500 text-black shadow-sm shadow-orange-500/25",
  },
  po: {
    default: "border-rose-500/35 bg-rose-500/15 text-rose-300",
    selected: "border-rose-400 bg-rose-500 text-white shadow-sm shadow-rose-500/25",
  },
};

export function conditionBadgeClassName(
  condition: CardCondition,
  options?: { selected?: boolean },
) {
  const styles = CONDITION_BADGE_STYLES[condition];
  return options?.selected ? styles.selected : styles.default;
}

export function isCardCondition(value: string): value is CardCondition {
  return CARD_CONDITIONS.includes(value as CardCondition);
}

export function normalizeLegacyCondition(value: string): CardCondition | null {
  if (isCardCondition(value)) {
    return value;
  }
  return LEGACY_CONDITION_MAP[value] ?? null;
}

export function sortAvailableConditions(
  conditions: Iterable<string>,
): CardCondition[] {
  const present = new Set(
    [...conditions]
      .map((condition) => normalizeLegacyCondition(condition))
      .filter((condition): condition is CardCondition => condition != null),
  );
  return CARD_CONDITIONS.filter((condition) => present.has(condition));
}

export const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
};
