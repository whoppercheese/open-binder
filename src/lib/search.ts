import { sql } from "drizzle-orm";
import type { UiLocale } from "@/lib/i18n/locale";

export type ParsedSearchQuery = {
  tokens: string[];
  raw: string;
};

export type CardSearchFields = {
  cardName: string;
  setName: string;
  officialCode: string | null;
  number: string;
};

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { tokens: [], raw: "" };
  }

  return {
    tokens: trimmed.split(/\s+/).filter(Boolean),
    raw: trimmed,
  };
}

export function isNumberToken(token: string): boolean {
  return /^\d+[a-zA-Z]?$/.test(token);
}

export function numbersMatch(storedNumber: string, token: string): boolean {
  return storedNumber === token;
}

export function isSearchableQuery(raw: string): boolean {
  const parsed = parseSearchQuery(raw);
  if (parsed.tokens.length === 0) {
    return false;
  }
  if (parsed.tokens.length === 1 && isNumberToken(parsed.tokens[0])) {
    return true;
  }
  return parsed.raw.length >= 2;
}

export function tokenMatchesCardFields(
  token: string,
  fields: CardSearchFields,
): boolean {
  if (isNumberToken(token)) {
    return numbersMatch(fields.number, token);
  }

  const lowerToken = token.toLowerCase();
  return (
    fields.cardName.toLowerCase().includes(lowerToken) ||
    fields.setName.toLowerCase().includes(lowerToken) ||
    (fields.officialCode?.toLowerCase() ?? "") === lowerToken
  );
}

export function cardMatchesAllTokens(
  tokens: readonly string[],
  fields: CardSearchFields,
): boolean {
  return tokens.every((token) => tokenMatchesCardFields(token, fields));
}

function localizedNameExpr(tableAlias: "c" | "s", locale: UiLocale) {
  return sql`lower(coalesce(${sql.raw(tableAlias)}.names->>${locale}, ${sql.raw(tableAlias)}.names->>'en', ''))`;
}

export function buildSetTokenMatchSql(token: string, locale: UiLocale) {
  const lowerToken = token.toLowerCase();
  const setNameExpr = localizedNameExpr("s", locale);
  const setCodeExpr = sql`lower(coalesce(s.official_code, ''))`;

  return sql`(
    ${setNameExpr} LIKE ${`%${lowerToken}%`}
    OR ${setCodeExpr} = ${lowerToken}
  )`;
}

/** @deprecated Use buildSetTokenMatchSql for single-token set matching. */
export function buildSetHintMatchSql(setHint: string, locale: UiLocale) {
  const tokens = setHint.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return sql`TRUE`;
  }

  const conditions = tokens.map((token) =>
    buildSetTokenMatchSql(token, locale),
  );
  return sql.join(conditions, sql` AND `);
}

export function buildTokenMatchSql(token: string, locale: UiLocale) {
  if (isNumberToken(token)) {
    return sql`c.number = ${token}`;
  }
  const lowerToken = token.toLowerCase();
  const cardNameExpr = localizedNameExpr("c", locale);
  const setNameExpr = localizedNameExpr("s", locale);
  const setCodeExpr = sql`lower(coalesce(s.official_code, ''))`;

  return sql`(
    ${cardNameExpr} LIKE ${`%${lowerToken}%`}
    OR ${setNameExpr} LIKE ${`%${lowerToken}%`}
    OR ${setCodeExpr} = ${lowerToken}
  )`;
}

export function buildSearchSql(
  parsed: ParsedSearchQuery,
  locale: UiLocale = "en",
  limit = 50,
): ReturnType<typeof sql> {
  if (parsed.tokens.length === 0) {
    return sql`SELECT NULL LIMIT 0`;
  }

  const conditions = parsed.tokens.map((token) =>
    buildTokenMatchSql(token, locale),
  );

  return sql`
    SELECT c.id
    FROM cards c
    INNER JOIN sets s ON s.id = c.set_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY s.release_date DESC NULLS LAST, c.number
    LIMIT ${limit}
  `;
}
