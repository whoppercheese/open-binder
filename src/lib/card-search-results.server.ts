import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cardPrices, cards, cardVariants, sets, userCards } from "@/db/schema";
import {
  localizedCardNameSql,
  localizedSetNameSql,
} from "@/lib/localized-names";
import { getLocalizedString } from "@/lib/catalog-languages";
import { buildCardVariantEntry } from "@/lib/card-variants.server";
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
    .leftJoin(userCards, eq(userCards.variantId, cardVariants.id))
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
      variants: [],
    });
  }

  return ordered;
}

export function extractSetIdFromCardId(cardId: string): string {
  const separator = cardId.lastIndexOf("-");
  return separator > 0 ? cardId.slice(0, separator) : cardId;
}

export function extractLocalIdFromCardId(cardId: string): string {
  const separator = cardId.lastIndexOf("-");
  return separator > 0 ? cardId.slice(separator + 1) : cardId;
}
