import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num == null || Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(num);
}

export function hasCardPrice(price: number | null | undefined): boolean {
  return price != null && !Number.isNaN(price);
}

export function formatCardPriceLabel(
  price: number | null | undefined,
  label = "Preis",
): string {
  return hasCardPrice(price) ? formatCurrency(price) : `${label}: —`;
}

export function formatCardPrice(price: number | null | undefined): string {
  return formatCardPriceLabel(price);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("de-DE", {
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

export const CONDITION_LABELS: Record<string, string> = {
  mint: "Mint",
  nm: "NM",
  lp: "LP",
  mp: "MP",
  hp: "HP",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
};
