import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cardPrices, cards, cardVariants, sets, userCards } from "@/db/schema";
import {
  localizedCardNameSql,
  localizedSetNameSql,
} from "@/lib/localized-names";
import { getLocalizedString } from "@/lib/catalog-languages";
import { buildCardVariantEntry } from "@/lib/card-variants.server";
import {
  extractLocalIdFromCardId,
  extractSetIdFromCardId,
} from "@/lib/card-id";
import { getChecklistCountsForCardIds } from "@/lib/checklist-membership.server";
import { getInventoryCountsForCardIds } from "@/lib/inventory-counts.server";
import type { UiLocale } from "@/lib/i18n/locale";
import { getPricePreference } from "@/lib/settings";

export type CardSearchResult = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  imageUrl: string | null;
  setId: string;
  setName: string;
  officialCode: string | null;
  owned: boolean;
  ownedQuantity: number;
  checklistCount: number;
  variants: Array<{
    id: string;
    variantType: string;
    ownedQuantity: number | null;
    price: number | null;
    cardmarketProductId: number | null;
  }>;
};

export async function loadCardSearchResults(
  cardIds: readonly string[],
  locale: UiLocale,
  imageUrlOverrides?: ReadonlyMap<string, string | null | undefined>,
  collectionId?: string,
): Promise<CardSearchResult[]> {
  if (cardIds.length === 0) {
    return [];
  }

  const preference = await getPricePreference();
  const nameSql = localizedCardNameSql(locale);
  const setNameSql = localizedSetNameSql(locale);

  const rows = await db
    .select({
      id: cards.id,
      number: cards.number,
      name: nameSql,
      rarity: cards.rarity,
      imageUrl: cards.imageUrl,
      setId: sets.id,
      setName: setNameSql,
      officialCode: sets.officialCode,
      variantId: cardVariants.id,
      variantType: cardVariants.variantType,
      cardmarketProductId: cardVariants.cardmarketProductId,
      ownedQuantity: userCards.quantity,
      trendEur: cardPrices.trendEur,
      lowEur: cardPrices.lowEur,
    })
    .from(cards)
    .innerJoin(sets, eq(cards.setId, sets.id))
    .innerJoin(cardVariants, eq(cardVariants.cardId, cards.id))
    .leftJoin(
      userCards,
      collectionId
        ? and(
            eq(userCards.variantId, cardVariants.id),
            eq(userCards.collectionId, collectionId),
          )
        : sql`false`,
    )
    .leftJoin(cardPrices, eq(cardPrices.variantId, cardVariants.id))
    .where(inArray(cards.id, cardIds))
    .orderBy(nameSql);

  const grouped = new Map<string, CardSearchResult>();

  for (const row of rows) {
    const existing = grouped.get(row.id) ?? {
      id: row.id,
      number: row.number,
      name: row.name,
      rarity: row.rarity,
      imageUrl: imageUrlOverrides?.get(row.id) ?? row.imageUrl,
      setId: row.setId,
      setName: row.setName,
      officialCode: row.officialCode,
      owned: false,
      ownedQuantity: 0,
      checklistCount: 0,
      variants: [],
    };

    const ownedQuantity = row.ownedQuantity ?? 0;
    existing.owned = existing.owned || ownedQuantity > 0;
    existing.variants.push({
      ...buildCardVariantEntry(row, preference, ownedQuantity),
      ownedQuantity: row.ownedQuantity,
    });
    grouped.set(row.id, existing);
  }

  const ordered: CardSearchResult[] = [];

  for (const cardId of cardIds) {
    const local = grouped.get(cardId);
    if (local) {
      ordered.push(local);
      continue;
    }

    const overrideImage = imageUrlOverrides?.get(cardId);
    if (overrideImage === undefined) {
      continue;
    }

    const setId = extractSetIdFromCardId(cardId);
    const setMeta = await db.query.sets.findFirst({
      where: eq(sets.id, setId),
      columns: {
        id: true,
        names: true,
        officialCode: true,
      },
    });

    ordered.push({
      id: cardId,
      number: extractLocalIdFromCardId(cardId),
      name: "",
      rarity: null,
      imageUrl: overrideImage ?? null,
      setId,
      setName: setMeta
        ? (getLocalizedString(setMeta.names, locale) ?? setId)
        : setId,
      officialCode: setMeta?.officialCode ?? null,
      owned: false,
      ownedQuantity: 0,
      checklistCount: 0,
      variants: [],
    });
  }

  const [checklistCounts, inventoryCounts] = await Promise.all([
    getChecklistCountsForCardIds(ordered.map((card) => card.id)),
    getInventoryCountsForCardIds(ordered.map((card) => card.id)),
  ]);
  for (const card of ordered) {
    card.checklistCount = checklistCounts.get(card.id) ?? 0;
    card.ownedQuantity = inventoryCounts.get(card.id) ?? 0;
    card.owned = card.ownedQuantity > 0;
  }

  return ordered;
}
