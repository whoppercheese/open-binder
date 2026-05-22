import { sql } from "drizzle-orm";

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
  limit = 50,
): ReturnType<typeof sql> {
  if (!parsed.text) {
    return sql`SELECT NULL LIMIT 0`;
  }

  if (parsed.setHint && parsed.number) {
    return sql`
      SELECT c.id
      FROM cards c
      INNER JOIN sets s ON s.id = c.set_id
      WHERE (
        lower(s.name_de) LIKE ${`%${parsed.setHint.toLowerCase()}%`}
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

  return sql`
    SELECT c.id
    FROM cards c
    INNER JOIN sets s ON s.id = c.set_id
    WHERE c.search_vector @@ to_tsquery('german', ${tsQuery})
       OR lower(c.name_de) LIKE ${`%${parsed.text.toLowerCase()}%`}
       OR lower(s.name_de) LIKE ${`%${parsed.text.toLowerCase()}%`}
    ORDER BY ts_rank(c.search_vector, to_tsquery('german', ${tsQuery})) DESC,
             s.release_date DESC NULLS LAST
    LIMIT ${limit}
  `;
}
