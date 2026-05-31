import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cardmarketProducts,
  cards,
} from "@/db/schema";
import { rebuildCardSearchVectors } from "@/lib/catalog-search";
import {
  mergeLocalized,
  getLocalizedString,
  type LocalizedStrings,
} from "@/lib/catalog-languages";
import { upsertVariantWithCardmarketId } from "@/lib/card-pricing.server";
import { ensureCardImage } from "@/lib/image-storage";
import type { UiLocale } from "@/lib/i18n/locale";
import { normalizeRarity } from "@/lib/rarity";
import { getUiLanguage } from "@/lib/settings";
import { encodeSyncJobMessage } from "@/lib/sync-job-messages";
import type { CatalogCardError } from "@/lib/sync-job-display";
import {
  CATALOG_FALLBACK_LANG,
  decodeTcgdexLocalId,
  delay,
  deriveVariantTypes,
  fetchCardWithFallback,
  fetchSetAllLangs,
  buildMultilangNameHints,
  mergeSetLocalizedFields,
  pickSetImageDetails,
  resolveCardImageCandidates,
  resolveSetCardSummariesFromDetails,
  type TcgdexSetDetail,
} from "@/lib/tcgdex";
const BATCH_DELAY_MS = 120;

function getCatalogSetCardLimit(): number | null {
  const raw = process.env.CATALOG_SET_CARD_LIMIT?.trim();
  if (!raw) return null;

  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    console.warn(
      `[catalog] Ignoring invalid CATALOG_SET_CARD_LIMIT: ${raw}`,
    );
    return null;
  }

  return limit;
}

async function lookupCardmarketName(
  productId: number | null | undefined,
): Promise<string | null> {
  if (!productId) return null;

  const product = await db.query.cardmarketProducts.findFirst({
    where: eq(cardmarketProducts.idProduct, productId),
    columns: { name: true },
  });

  return product?.name ?? null;
}

function resolveCardNamesFromHints(
  hints: LocalizedStrings | undefined,
  cardmarketName: string | null,
  fetchedName: string | null,
  fetchedLang: "de" | "en",
): LocalizedStrings {
  const names: LocalizedStrings = { ...(hints ?? {}) };

  if (cardmarketName && !names.en) {
    names.en = cardmarketName;
  }

  if (fetchedName) {
    const lang = fetchedLang === "de" ? "de" : "en";
    if (!names[lang]) {
      names[lang] = fetchedName;
    }
  }

  return names;
}

export async function syncSingleCard(
  cardId: string,
  seriesId: string,
  setId: string,
  catalogLang: UiLocale,
  hints?: LocalizedStrings,
) {
  const fallbackLang: UiLocale = catalogLang === "de" ? "en" : "de";
  const { card, lang } = await fetchCardWithFallback(
    cardId,
    catalogLang,
    fallbackLang,
  );
  const imageLang = catalogLang;
  const { imageUrl } = await ensureCardImage(card.id, imageLang, {
    force: true,
    syncContext: { card, seriesId, setId },
  });
  const imageCandidates = resolveCardImageCandidates(
    card,
    seriesId,
    setId,
    imageLang,
  );
  const resolvedImageUrl = imageUrl ?? imageCandidates[0] ?? null;

  const cardmarketName = await lookupCardmarketName(
    card.pricing?.cardmarket?.idProduct,
  );
  const incomingNames = resolveCardNamesFromHints(
    hints,
    cardmarketName,
    card.name,
    lang === "de" ? "de" : "en",
  );

  const existing = await db.query.cards.findFirst({
    where: eq(cards.id, card.id),
    columns: { names: true },
  });
  const mergedNames = mergeLocalized(existing?.names ?? {}, incomingNames);
  const canonicalRarity = normalizeRarity(
    card.rarity ?? null,
    lang === CATALOG_FALLBACK_LANG ? "en" : (lang as "de"),
  );
  const illustrator = card.illustrator?.trim() || null;

  await db
    .insert(cards)
    .values({
      id: card.id,
      setId,
      number: card.localId,
      names: mergedNames,
      rarity: canonicalRarity,
      illustrator,
      imageUrl: resolvedImageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        setId,
        number: card.localId,
        names: mergedNames,
        rarity: canonicalRarity,
        illustrator,
        imageUrl: resolvedImageUrl,
        updatedAt: new Date(),
      },
    });

  await rebuildCardSearchVectors(card.id);

  const variantTypes = deriveVariantTypes(card.variants);
  const cardmarketProductId = card.pricing?.cardmarket?.idProduct ?? null;

  for (const variantType of variantTypes) {
    await upsertVariantWithCardmarketId(card.id, variantType, cardmarketProductId);
  }
}

export async function syncSetCards(
  setId: string,
  cardErrors: CatalogCardError[],
  onProgress?: (message: string) => Promise<void>,
): Promise<TcgdexSetDetail> {
  const catalogLang = await getUiLanguage();
  const details = await fetchSetAllLangs(setId);
  const { detail, names: setNames } = mergeSetLocalizedFields(details);
  const seriesId = detail.serie?.id ?? "unknown";
  const { deDetail, enDetail } = pickSetImageDetails(details, detail);
  const nameHints = buildMultilangNameHints(details);
  const cardSummaries = resolveSetCardSummariesFromDetails(deDetail, enDetail);

  const cardLimit = getCatalogSetCardLimit();
  const cardsToSync =
    cardLimit != null ? cardSummaries.slice(0, cardLimit) : cardSummaries;

  if (cardLimit != null && cardSummaries.length > cardLimit) {
    console.warn(
      `[catalog] CATALOG_SET_CARD_LIMIT=${cardLimit}: syncing ${cardsToSync.length}/${cardSummaries.length} cards for set ${setId}`,
    );
  }

  const totalCards = cardsToSync.length;

  for (let index = 0; index < cardsToSync.length; index += 1) {
    const cardSummary = cardsToSync[index];
    const localId = decodeTcgdexLocalId(cardSummary.localId);
    const hints = nameHints.get(localId);

    try {
      await syncSingleCard(cardSummary.id, seriesId, detail.id, catalogLang, hints);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Kartenfehler";
      cardErrors.push({
        setId: detail.id,
        setName: getLocalizedString(setNames, "en") ?? detail.name,
        cardId: cardSummary.id,
        error: message,
      });
      console.warn(
        `[catalog] Skipping card ${cardSummary.id} in set ${detail.id}: ${message}`,
      );
    }

    if (onProgress) {
      await onProgress(
        encodeSyncJobMessage("setCardsProgress", {
          current: index + 1,
          total: totalCards,
          name: detail.name,
        }),
      );
    }

    await delay(BATCH_DELAY_MS);
  }

  return detail;
}
