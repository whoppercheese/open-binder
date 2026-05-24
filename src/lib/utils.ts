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

export function isCardCondition(value: string): value is CardCondition {
  return CARD_CONDITIONS.includes(value as CardCondition);
}

export const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
};
