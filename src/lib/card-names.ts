import { sql } from "drizzle-orm";
import { cards } from "@/db/schema";

export type CardNameSource = "de" | "en" | "cardmarket";

export type ResolvedCardNames = {
  nameDe: string | null;
  nameEn: string | null;
  nameSource: CardNameSource;
};

export function resolveCardNames(options: {
  deName?: string | null;
  enName?: string | null;
  cardmarketName?: string | null;
  fetchedName?: string | null;
  fetchedLang?: "de" | "en";
}): ResolvedCardNames {
  const deName = options.deName?.trim() || null;
  const enName = options.enName?.trim() || null;
  const cardmarketName = options.cardmarketName?.trim() || null;

  if (deName) {
    return { nameDe: deName, nameEn: enName, nameSource: "de" };
  }

  if (cardmarketName) {
    return { nameDe: cardmarketName, nameEn: enName, nameSource: "cardmarket" };
  }

  if (enName) {
    return { nameDe: null, nameEn: enName, nameSource: "en" };
  }

  const fetchedName = options.fetchedName?.trim() || null;
  if (fetchedName) {
    if (options.fetchedLang === "de") {
      return { nameDe: fetchedName, nameEn: null, nameSource: "de" };
    }
    return { nameDe: null, nameEn: fetchedName, nameSource: "en" };
  }

  return { nameDe: null, nameEn: null, nameSource: "en" };
}

export function getCardDisplayName(card: {
  nameDe: string | null;
  nameEn?: string | null;
}): string {
  return card.nameDe ?? card.nameEn ?? "Unbekannt";
}

export const cardDisplayNameSql = sql<string>`coalesce(${cards.nameDe}, ${cards.nameEn}, 'Unbekannt')`;
