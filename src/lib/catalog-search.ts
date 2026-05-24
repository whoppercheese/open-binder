import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, catalogSearchVectors, sets } from "@/db/schema";
import { TS_CONFIG } from "@/lib/catalog-languages";
import { UI_LOCALES, type UiLocale } from "@/lib/i18n/locale";

export async function rebuildCardSearchVectors(
  cardId: string,
  uiLocales: readonly UiLocale[] = UI_LOCALES,
) {
  for (const locale of uiLocales) {
    const tsConfig = TS_CONFIG[locale];
    await db.execute(sql`
      INSERT INTO catalog_search_vectors (entity_type, entity_id, locale, search_vector)
      SELECT
        'card',
        c.id,
        ${locale},
        to_tsvector(
          ${sql.raw(`'${tsConfig}'`)},
          coalesce(c.names->>${locale}, c.names->>'en', '') || ' ' ||
          coalesce(c.number, '') || ' ' ||
          coalesce(s.names->>${locale}, s.names->>'en', '') || ' ' ||
          coalesce(s.official_code, '')
        )
      FROM cards c
      INNER JOIN sets s ON s.id = c.set_id
      WHERE c.id = ${cardId}
      ON CONFLICT (entity_type, entity_id, locale)
      DO UPDATE SET search_vector = EXCLUDED.search_vector
    `);
  }
}

export async function rebuildAllSearchVectors(
  uiLocales: readonly UiLocale[] = UI_LOCALES,
) {
  const cardRows = await db.select({ id: cards.id }).from(cards);
  for (const row of cardRows) {
    await rebuildCardSearchVectors(row.id, uiLocales);
  }
}
