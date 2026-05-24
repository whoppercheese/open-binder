import { sql } from "drizzle-orm";
import { TS_CONFIG } from "@/lib/catalog-languages";
import type { UiLocale } from "@/lib/i18n/locale";

export type ParsedSearchQuery = {
  text: string;
  setHint: string | null;
  number: string | null;
};

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: "", setHint: null, number: null };
  }

  const comboMatch = trimmed.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/);
  if (comboMatch) {
    return {
      text: trimmed,
      setHint: comboMatch[1].trim(),
      number: comboMatch[2].trim(),
    };
  }

  if (/^\d+[a-zA-Z]?$/.test(trimmed)) {
    return { text: trimmed, setHint: null, number: trimmed };
  }

  return { text: trimmed, setHint: null, number: null };
}

export function buildSearchSql(
  parsed: ParsedSearchQuery,
  locale: UiLocale = "en",
  limit = 50,
): ReturnType<typeof sql> {
  if (!parsed.text) {
    return sql`SELECT NULL LIMIT 0`;
  }

  const setNameExpr = sql`coalesce(s.names->>${locale}, s.names->>'en', '')`;
  const cardNameExpr = sql`coalesce(c.names->>${locale}, c.names->>'en', '')`;

  if (parsed.setHint && parsed.number) {
    return sql`
      SELECT c.id
      FROM cards c
      INNER JOIN sets s ON s.id = c.set_id
      WHERE (
        lower(${setNameExpr}) LIKE ${`%${parsed.setHint.toLowerCase()}%`}
        OR lower(coalesce(s.official_code, '')) = ${parsed.setHint.toLowerCase()}
        OR lower(s.id) = ${parsed.setHint.toLowerCase()}
      )
      AND c.number = ${parsed.number}
      ORDER BY s.release_date DESC NULLS LAST, c.number
      LIMIT ${limit}
    `;
  }

  if (parsed.number && !parsed.setHint) {
    return sql`
      SELECT c.id
      FROM cards c
      INNER JOIN sets s ON s.id = c.set_id
      WHERE c.number = ${parsed.number}
      ORDER BY s.release_date DESC NULLS LAST, c.number
      LIMIT ${limit}
    `;
  }

  const tsQuery = parsed.text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part}:*`)
    .join(" & ");

  const tsConfig = TS_CONFIG[locale];

  return sql`
    SELECT c.id
    FROM cards c
    INNER JOIN sets s ON s.id = c.set_id
    LEFT JOIN catalog_search_vectors csv ON csv.entity_type = 'card'
      AND csv.entity_id = c.id
      AND csv.locale = ${locale}
    WHERE csv.search_vector @@ to_tsquery(${tsConfig}, ${tsQuery})
       OR lower(${cardNameExpr}) LIKE ${`%${parsed.text.toLowerCase()}%`}
       OR lower(${setNameExpr}) LIKE ${`%${parsed.text.toLowerCase()}%`}
    ORDER BY ts_rank(csv.search_vector, to_tsquery(${tsConfig}, ${tsQuery})) DESC NULLS LAST,
             s.release_date DESC NULLS LAST
    LIMIT ${limit}
  `;
}
