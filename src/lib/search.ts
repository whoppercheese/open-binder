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
  illustrator: string | null;
  matchedIllustratorTokens?: readonly string[];
};

function illustratorMatchesToken(
  illustrator: string | null | undefined,
  token: string,
): boolean {
  if (!illustrator) {
    return false;
  }

  return illustrator.toLowerCase().includes(token.toLowerCase());
}

function tokenMatchedViaIllustratorFetch(
  token: string,
  matchedIllustratorTokens?: readonly string[],
): boolean {
  if (!matchedIllustratorTokens?.length) {
    return false;
  }

  const lowerToken = token.toLowerCase();
  return matchedIllustratorTokens.some(
    (matchedToken) => matchedToken.toLowerCase() === lowerToken,
  );
}

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
    (fields.officialCode?.toLowerCase() ?? "") === lowerToken ||
    illustratorMatchesToken(fields.illustrator, token) ||
    tokenMatchedViaIllustratorFetch(token, fields.matchedIllustratorTokens)
  );
}

export function cardMatchesAllTokens(
  tokens: readonly string[],
  fields: CardSearchFields,
): boolean {
  return tokens.every((token) => tokenMatchesCardFields(token, fields));
}

export function tokenMatchesCatalogSearchFields(
  token: string,
  fields: CardSearchFields,
): boolean {
  if (isNumberToken(token)) {
    return numbersMatch(fields.number, token);
  }

  const lowerToken = token.toLowerCase();
  return (
    fields.cardName.toLowerCase().includes(lowerToken) ||
    fields.setName.toLowerCase() === lowerToken ||
    (fields.officialCode?.toLowerCase() ?? "") === lowerToken ||
    illustratorMatchesToken(fields.illustrator, token) ||
    tokenMatchedViaIllustratorFetch(token, fields.matchedIllustratorTokens)
  );
}

export function cardMatchesAllCatalogTokens(
  tokens: readonly string[],
  fields: CardSearchFields,
): boolean {
  return tokens.every((token) => tokenMatchesCatalogSearchFields(token, fields));
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function cardMatchesCatalogSearchQuery(
  raw: string,
  tokens: readonly string[],
  fields: CardSearchFields,
): boolean {
  const normalizedQuery = normalizeSearchText(raw);
  const normalizedCardName = normalizeSearchText(fields.cardName);
  const normalizedIllustrator = normalizeSearchText(fields.illustrator ?? "");

  if (
    normalizedQuery.length >= 2 &&
    normalizedCardName.includes(normalizedQuery)
  ) {
    return true;
  }

  if (
    normalizedQuery.length >= 2 &&
    normalizedIllustrator.includes(normalizedQuery)
  ) {
    return true;
  }

  return cardMatchesAllCatalogTokens(tokens, fields);
}

export function scoreCatalogSearchMatch(
  raw: string,
  tokens: readonly string[],
  fields: CardSearchFields,
): number {
  const lowerName = fields.cardName.toLowerCase();
  const lowerRaw = raw.trim().toLowerCase();
  const normalizedQuery = normalizeSearchText(raw);
  const normalizedName = normalizeSearchText(fields.cardName);
  const normalizedIllustrator = normalizeSearchText(fields.illustrator ?? "");
  const lowerIllustrator = fields.illustrator?.toLowerCase() ?? "";

  let score = 0;

  if (lowerRaw.length > 0 && lowerName === lowerRaw) {
    score += 1000;
  } else if (normalizedQuery.length >= 2 && normalizedName === normalizedQuery) {
    score += 950;
  } else if (
    normalizedQuery.length >= 2 &&
    normalizedName.includes(normalizedQuery)
  ) {
    score += 200;
  } else if (
    normalizedQuery.length >= 2 &&
    normalizedIllustrator.includes(normalizedQuery)
  ) {
    score += 180;
  } else if (lowerRaw.length > 0 && lowerIllustrator === lowerRaw) {
    score += 900;
  }

  for (const token of tokens) {
    if (isNumberToken(token)) {
      if (numbersMatch(fields.number, token)) {
        score += 80;
      }
      continue;
    }

    const lowerToken = token.toLowerCase();
    if (lowerName === lowerToken) {
      score += 500;
    } else if (
      lowerName.startsWith(`${lowerToken} `) ||
      lowerName.startsWith(`${lowerToken}-`)
    ) {
      score += 150;
    } else if (lowerName.includes(lowerToken)) {
      score += 50;
    }
    if ((fields.officialCode?.toLowerCase() ?? "") === lowerToken) {
      score += 100;
    }
    if (fields.setName.toLowerCase() === lowerToken) {
      score += 80;
    }
    if (illustratorMatchesToken(fields.illustrator, token)) {
      score += 70;
    }
    if (tokenMatchedViaIllustratorFetch(token, fields.matchedIllustratorTokens)) {
      score += 70;
    }
  }

  return score;
}

const DEFAULT_MAX_DUPLICATE_NAME_RESULTS = 6;

export function pickDiverseSearchResults<T extends { id: string; name: string }>(
  sorted: readonly T[],
  limit: number,
  maxPerExactName = DEFAULT_MAX_DUPLICATE_NAME_RESULTS,
): T[] {
  const selected: T[] = [];
  const seenIds = new Set<string>();
  const nameCounts = new Map<string, number>();

  for (const item of sorted) {
    if (selected.length >= limit) {
      break;
    }
    if (seenIds.has(item.id)) {
      continue;
    }

    const duplicateCount = nameCounts.get(item.name) ?? 0;
    if (duplicateCount >= maxPerExactName) {
      continue;
    }

    nameCounts.set(item.name, duplicateCount + 1);
    seenIds.add(item.id);
    selected.push(item);
  }

  for (const item of sorted) {
    if (selected.length >= limit) {
      break;
    }
    if (seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    selected.push(item);
  }

  return selected;
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
  const illustratorExpr = sql`lower(coalesce(c.illustrator, ''))`;

  return sql`(
    ${cardNameExpr} LIKE ${`%${lowerToken}%`}
    OR ${setNameExpr} LIKE ${`%${lowerToken}%`}
    OR ${setCodeExpr} = ${lowerToken}
    OR ${illustratorExpr} LIKE ${`%${lowerToken}%`}
  )`;
}

export function buildSearchSql(
  parsed: ParsedSearchQuery,
  locale: UiLocale = "en",
  limit = 24,
  offset = 0,
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
    WHERE (
      s.cards_synced_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM collection_cards cc WHERE cc.card_id = c.id
      )
    )
    AND ${sql.join(conditions, sql` AND `)}
    ORDER BY s.release_date DESC NULLS LAST, c.number
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}
