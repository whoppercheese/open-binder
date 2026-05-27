import type { UiLocale } from "@/lib/i18n/locale";
import { isUiLocale } from "@/lib/i18n/locale";

export type SetImageKind = "logo" | "symbol";

/** Dots in set ids (e.g. me02.5) must be encoded or Next.js may not match the route. */
function encodeCardIdPathSegment(cardId: string): string {
  return cardId.replace(/\./g, "%2E");
}

/** Bumps when cache semantics change; busts poisoned browser caches. */
const CARD_IMAGE_CACHE_VERSION = "4";

export function getCardImageApiPath(cardId: string, locale: UiLocale): string {
  const id = encodeCardIdPathSegment(cardId);
  return `/api/images/${id}?lang=${locale}&v=${CARD_IMAGE_CACHE_VERSION}`;
}

export function getCollectionCoverApiPath(
  collectionId: string,
  version?: string | number,
): string {
  const base = `/api/collection-covers/${encodeURIComponent(collectionId)}`;
  if (version == null) {
    return base;
  }

  return `${base}?v=${encodeURIComponent(String(version))}`;
}

export function getSetImageApiPath(setId: string, kind: SetImageKind): string {
  return `/api/set-images/${encodeURIComponent(setId)}/${kind}`;
}

const TCGDEX_ASSETS_LANG_PATTERN =
  /assets\.tcgdex\.net\/(en|de)\//;

export function resolveTcgdexImageLocale(url: string): UiLocale | null {
  const match = url.match(TCGDEX_ASSETS_LANG_PATTERN);
  if (!match?.[1] || !isUiLocale(match[1])) {
    return null;
  }

  return match[1];
}

export function localizeTcgdexImageUrl(url: string, locale: UiLocale): string {
  if (!TCGDEX_ASSETS_LANG_PATTERN.test(url)) {
    return url;
  }

  return url.replace(TCGDEX_ASSETS_LANG_PATTERN, `assets.tcgdex.net/${locale}/`);
}

export function getTcgdexAlternateLanguageImageUrl(
  url: string,
  locale: UiLocale,
): string | null {
  const alternate: UiLocale = locale === "de" ? "en" : "de";
  const localized = localizeTcgdexImageUrl(url, locale);
  const alternateUrl = localizeTcgdexImageUrl(url, alternate);
  if (alternateUrl === localized) {
    return null;
  }

  return alternateUrl;
}
