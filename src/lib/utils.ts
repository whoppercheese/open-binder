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

export const CARD_CONDITIONS = ["mint", "nm", "lp", "mp", "hp"] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CONDITION_LABELS: Record<CardCondition, string> = {
  mint: "Mint",
  nm: "NM",
  lp: "LP",
  mp: "MP",
  hp: "HP",
};

export const CONDITION_I18N_KEYS: Record<CardCondition, string> = {
  mint: "common.conditionMint",
  nm: "common.conditionNm",
  lp: "common.conditionLp",
  mp: "common.conditionMp",
  hp: "common.conditionHp",
};

/** Tailwind classes per condition — green (mint) → red (HP), consistent app-wide. */
export const CONDITION_BADGE_STYLES: Record<
  CardCondition,
  { default: string; selected: string }
> = {
  mint: {
    default: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
    selected: "border-emerald-400 bg-emerald-500 text-black shadow-sm shadow-emerald-500/25",
  },
  nm: {
    default: "border-sky-500/35 bg-sky-500/15 text-sky-300",
    selected: "border-sky-400 bg-sky-500 text-black shadow-sm shadow-sky-500/25",
  },
  lp: {
    default: "border-amber-500/35 bg-amber-500/15 text-amber-300",
    selected: "border-amber-400 bg-amber-500 text-black shadow-sm shadow-amber-500/25",
  },
  mp: {
    default: "border-orange-500/35 bg-orange-500/15 text-orange-300",
    selected: "border-orange-400 bg-orange-500 text-black shadow-sm shadow-orange-500/25",
  },
  hp: {
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

export const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
};
