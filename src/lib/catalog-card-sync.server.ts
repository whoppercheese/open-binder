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
import { upsertVariantWithPricing } from "@/lib/card-pricing.server";
import { cacheCardImage } from "@/lib/image-storage";
import { normalizeRarity } from "@/lib/rarity";
import { encodeSyncJobMessage } from "@/lib/sync-job-messages";
import type { CatalogCardError } from "@/lib/sync-job-display";
import {
  buildImageUrl,
  CATALOG_FALLBACK_LANG,
  decodeTcgdexLocalId,
  delay,
  deriveVariantTypes,
  fetchCardWithFallback,
  fetchSetAllLangs,
  buildMultilangNameHints,
  mergeSetLocalizedFields,
  pickSetImageDetails,
  pricingForVariant,
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

async function syncCard(
  cardId: string,
  seriesId: string,
  setId: string,
  hints?: LocalizedStrings,
) {
  const { card, lang } = await fetchCardWithFallback(cardId);
  const imageUrl = buildImageUrl(seriesId, setId, card.localId);
  await cacheCardImage(card.id, imageUrl);

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

  await db
    .insert(cards)
    .values({
      id: card.id,
      setId,
      number: card.localId,
      names: mergedNames,
      rarity: canonicalRarity,
      imageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        setId,
        number: card.localId,
        names: mergedNames,
        rarity: canonicalRarity,
        imageUrl,
        updatedAt: new Date(),
      },
    });

  await rebuildCardSearchVectors(card.id);

  const variantTypes = deriveVariantTypes(card.variants);
  const pricing = card.pricing?.cardmarket;

  for (const variantType of variantTypes) {
    const variantPricing = pricingForVariant(variantType, pricing, card.variants);
    await upsertVariantWithPricing(card.id, variantType, variantPricing);
  }
}

export async function syncSetCards(
  setId: string,
  cardErrors: CatalogCardError[],
  onProgress?: (message: string) => Promise<void>,
): Promise<TcgdexSetDetail> {
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
      await syncCard(cardSummary.id, seriesId, detail.id, hints);
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
