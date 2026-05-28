import type { CardDetail } from "@/components/card-modal";
import { apiUrl } from "@/lib/i18n/context";
import type { UiLocale } from "@/lib/i18n/locale";

type EnsureCardsResponse = {
  synced?: string[];
  failed?: Array<{ cardId: string; error: string }>;
  errorCode?: string;
};

export async function ensureCardsInCatalogClient(
  cardIds: string[],
  locale: UiLocale,
): Promise<{ synced: string[]; failed: Array<{ cardId: string; error: string }> }> {
  const response = await fetch(apiUrl("/api/cards/bulk-checklist", locale), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardIds, collectionIds: [] }),
  });
  const payload = (await response.json()) as EnsureCardsResponse;

  if (!response.ok) {
    throw new Error(payload.errorCode ?? "CARDS_ENSURE_FAILED");
  }

  return {
    synced: payload.synced ?? [],
    failed: payload.failed ?? [],
  };
}

export async function loadCardDetailClient(
  cardId: string,
  locale: UiLocale,
): Promise<CardDetail> {
  const response = await fetch(apiUrl(`/api/cards/${cardId}`, locale));
  const payload = (await response.json()) as CardDetail & { errorCode?: string };

  if (!response.ok) {
    throw new Error(payload.errorCode ?? "CARD_LOAD_FAILED");
  }

  return payload;
}

export async function loadOrEnsureCardClient(
  cardId: string,
  locale: UiLocale,
): Promise<CardDetail> {
  try {
    const existing = await loadCardDetailClient(cardId, locale);
    if (existing.variants.length > 0) {
      return existing;
    }
  } catch {
    // Card is not in the catalog yet — ensure below.
  }

  return ensureAndLoadCardClient(cardId, locale);
}

export async function ensureAndLoadCardClient(
  cardId: string,
  locale: UiLocale,
): Promise<CardDetail> {
  const result = await ensureCardsInCatalogClient([cardId], locale);
  if (!result.synced.includes(cardId)) {
    throw new Error("CARDS_ENSURE_FAILED");
  }

  return loadCardDetailClient(cardId, locale);
}
