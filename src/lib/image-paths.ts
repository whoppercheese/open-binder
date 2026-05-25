export type SetImageKind = "logo" | "symbol";

export function getCardImageApiPath(cardId: string): string {
  return `/api/images/${encodeURIComponent(cardId)}`;
}

export function getSetImageApiPath(setId: string, kind: SetImageKind): string {
  return `/api/set-images/${encodeURIComponent(setId)}/${kind}`;
}

export function getTcgdexEnglishImageUrl(url: string): string | null {
  if (!url.includes("assets.tcgdex.net/de/")) {
    return null;
  }

  return url.replace("assets.tcgdex.net/de/", "assets.tcgdex.net/en/");
}
