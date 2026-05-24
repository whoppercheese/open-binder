import type { TcgdexLanguage } from "@/lib/catalog-languages";
import type { TranslateFn } from "@/lib/i18n/messages";

/** DE/FR TCGdex strings → EN canonical (TCGdex EN list). */
const LOCALIZED_TO_CANONICAL: Record<string, string> = {
  Häufig: "Common",
  Ungewöhnlich: "Uncommon",
  Selten: "Rare",
  Doppelselten: "Double rare",
  "Doppel-Selten": "Double rare",
  Hyperselten: "Hyper rare",
  "Ultra Selten": "Ultra Rare",
  "Selten, Illustration": "Illustration rare",
  "Illustrations-Selten": "Illustration rare",
  "Selten, besondere Illustration": "Special illustration rare",
  "Selten, Strahlend": "Radiant Rare",
  "Versteckt Selten": "Secret Rare",
  Keine: "None",
  Atemberaubend: "Amazing Rare",
  "ASS-KLASSE": "ACE SPEC Rare",
  "Holografisch Selten": "Holo Rare",
  "Selten, Holografisch": "Rare Holo",
  "Holografisch Selten V": "Holo Rare V",
  "Holografisch Selten VMAX": "Holo Rare VMAX",
  "Holografisch Selten VSTAR": "Holo Rare VSTAR",
  LEGENDE: "LEGEND",
  "Mega Hyper Selten": "Mega Hyper Rare",
  "Schwarz-Weiß Selten": "Black White Rare",
  Vollkunsttrainer: "Full Art Trainer",
  Commune: "Common",
  "Peu Commune": "Uncommon",
  Couronne: "Crown",
};

export const CANONICAL_RARITY_ORDER = [
  "None",
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Double rare",
  "Ultra Rare",
  "Illustration rare",
  "Special illustration rare",
  "Hyper rare",
  "Secret Rare",
  "Radiant Rare",
  "Amazing Rare",
  "ACE SPEC Rare",
  "Holo Rare",
  "Holo Rare V",
  "Holo Rare VMAX",
  "Holo Rare VSTAR",
  "Shiny rare",
  "Shiny rare V",
  "Shiny rare VMAX",
  "Shiny Ultra Rare",
  "LEGEND",
  "Mega Hyper Rare",
  "Black White Rare",
  "Classic Collection",
  "Crown",
  "Full Art Trainer",
  "Rare Holo LV.X",
  "Rare PRIME",
  "Promo",
] as const;

export function slugifyRarity(canonical: string): string {
  const slug = canonical
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^./, (c) => c.toLowerCase());
  return slug || "unknown";
}

export function normalizeRarity(
  raw: string | null | undefined,
  sourceLang: TcgdexLanguage = "en",
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  if (sourceLang === "en") {
    return trimmed;
  }

  return LOCALIZED_TO_CANONICAL[trimmed] ?? trimmed;
}

export function getRarityLabel(
  canonical: string | null | undefined,
  t: TranslateFn,
): string | null {
  if (!canonical) return null;
  const slug = slugifyRarity(canonical);
  const key = `rarity.${slug}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return canonical;
}

export function sortCanonicalRarities(rarities: string[]): string[] {
  return [...rarities].sort((a, b) => {
    const indexA = CANONICAL_RARITY_ORDER.indexOf(
      a as (typeof CANONICAL_RARITY_ORDER)[number],
    );
    const indexB = CANONICAL_RARITY_ORDER.indexOf(
      b as (typeof CANONICAL_RARITY_ORDER)[number],
    );
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, "en");
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}
