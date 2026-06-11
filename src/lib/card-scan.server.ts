import "server-only";

import {
  CardSightApiError,
  type CardSightDetection,
  type CardSightFieldValue,
  type CardSightIdentifyResponse,
  type CardSightMessage,
  identifyPokemonCard,
} from "@/lib/cardsight.server";
import {
  getCatalogSetIndex,
  matchCatalogSetIdsForBulkFetch,
} from "@/lib/catalog-set-index.server";
import { searchCards } from "@/lib/card-search.server";
import type { UiLocale } from "@/lib/i18n/locale";

export type CardScanErrorCode =
  | "SCAN_NO_CARD"
  | "SCAN_UPSTREAM_AUTH"
  | "SCAN_UPSTREAM_RATE_LIMIT"
  | "SCAN_FAILED";

export type CardScanMeta = {
  query: string;
  requestId?: string;
  confidence?: string;
  detectedSetCode?: string;
  detectedNumber?: string;
  messages?: CardSightMessage[];
};

export type CardScanSuccess = Awaited<ReturnType<typeof searchCards>> & {
  scan: CardScanMeta;
};

export type CardScanResult =
  | CardScanSuccess
  | { error: CardScanErrorCode };

const CONFIDENCE_RANK: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const SET_CODE_FIELD_KEYS = new Set([
  "set_code",
  "setcode",
  "set_abbreviation",
  "setabbreviation",
  "expansion_code",
  "expansioncode",
  "set_symbol",
  "setsymbol",
]);

function isExactMatch(detection: CardSightDetection): boolean {
  return Boolean(detection.card.id?.trim());
}

function confidenceRank(confidence: string): number {
  return CONFIDENCE_RANK[confidence] ?? 0;
}

export function pickPrimaryDetection(
  detections: readonly CardSightDetection[],
): CardSightDetection | null {
  if (detections.length === 0) {
    return null;
  }

  const exactMatches = detections.filter(isExactMatch);
  const pool = exactMatches.length > 0 ? exactMatches : detections;

  return [...pool].sort(
    (left, right) =>
      confidenceRank(right.confidence) - confidenceRank(left.confidence),
  )[0];
}

export function normalizeScanCardNumber(
  raw: string | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const primary = trimmed.split("/")[0]?.trim();
  return primary || null;
}

function getSetCodeFromFields(
  fields: readonly CardSightFieldValue[] | undefined,
): string | null {
  if (!fields?.length) {
    return null;
  }

  for (const field of fields) {
    const key = field.key?.trim().toLowerCase();
    const value = field.value?.trim();
    if (!key || !value) {
      continue;
    }
    if (SET_CODE_FIELD_KEYS.has(key.replace(/[\s-]+/g, "_"))) {
      return value;
    }
  }

  return null;
}

function resolveSetCodeFromLabel(
  setLabel: string,
  index: Awaited<ReturnType<typeof getCatalogSetIndex>>,
): string | null {
  const matchedSetIds = matchCatalogSetIdsForBulkFetch(setLabel, index);
  if (matchedSetIds.length !== 1) {
    return null;
  }

  const entry = index.find((item) => item.id === matchedSetIds[0]);
  if (!entry) {
    return null;
  }

  return entry.officialCode?.trim() || entry.id;
}

async function resolveSetCode(
  detection: CardSightDetection,
  locale: UiLocale,
): Promise<string | null> {
  const fromFields = getSetCodeFromFields(detection.card.fields);
  if (fromFields) {
    return fromFields;
  }

  const setLabel =
    detection.card.setName?.trim() ?? detection.card.releaseName?.trim();
  if (!setLabel) {
    return null;
  }

  const localized = await getCatalogSetIndex(locale);
  const localizedCode = resolveSetCodeFromLabel(setLabel, localized);
  if (localizedCode) {
    return localizedCode;
  }

  if (locale !== "en") {
    const english = await getCatalogSetIndex("en");
    return resolveSetCodeFromLabel(setLabel, english);
  }

  return null;
}

export async function buildScanSearchQuery(
  detection: CardSightDetection,
  locale: UiLocale,
): Promise<string | null> {
  const number = normalizeScanCardNumber(detection.card.number);
  const setCode = await resolveSetCode(detection, locale);
  if (!number || !setCode) {
    return null;
  }

  return `${setCode} ${number}`;
}

function buildScanMeta(
  detection: CardSightDetection,
  query: string,
  setCode: string,
  number: string,
  response: CardSightIdentifyResponse,
): CardScanMeta {
  return {
    query,
    requestId: response.requestId,
    confidence: detection.confidence,
    detectedSetCode: setCode,
    detectedNumber: number,
    messages: response.messages,
  };
}

function buildScanSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const scoped = new URLSearchParams();
  scoped.set("scope", "all");

  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  if (limit) {
    scoped.set("limit", limit);
  }
  if (offset) {
    scoped.set("offset", offset);
  }

  return scoped;
}

export async function scanCardAndSearch(
  imageBytes: Buffer,
  mimeType: string,
  locale: UiLocale,
  searchParams: URLSearchParams,
): Promise<CardScanResult> {
  let identifyResponse: CardSightIdentifyResponse;

  try {
    identifyResponse = await identifyPokemonCard(imageBytes, mimeType);
  } catch (error) {
    if (error instanceof CardSightApiError) {
      return { error: error.code };
    }
    return { error: "SCAN_FAILED" };
  }

  const detections = identifyResponse.detections ?? [];
  const primary = pickPrimaryDetection(detections);
  if (!primary) {
    return { error: "SCAN_NO_CARD" };
  }

  const number = normalizeScanCardNumber(primary.card.number);
  const setCode = await resolveSetCode(primary, locale);
  if (!number || !setCode) {
    return { error: "SCAN_NO_CARD" };
  }

  const query = `${setCode} ${number}`;
  const searchPage = await searchCards(
    query,
    locale,
    buildScanSearchParams(searchParams),
  );

  return {
    ...searchPage,
    scan: buildScanMeta(primary, query, setCode, number, identifyResponse),
  };
}
