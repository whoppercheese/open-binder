import "server-only";

import {
  CardSightApiError,
  type CardSightDetection,
  type CardSightIdentifyResponse,
  type CardSightMessage,
  identifyPokemonCard,
} from "@/lib/cardsight.server";
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
  detectedName?: string;
  detectedNumber?: string;
  detectedSet?: string;
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

export function buildScanSearchQuery(detection: CardSightDetection): string {
  const { card } = detection;
  const parts = [
    card.name?.trim(),
    card.number?.trim(),
    card.setName?.trim() ?? card.releaseName?.trim(),
    card.year?.trim(),
  ].filter((part): part is string => Boolean(part));

  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tokens.push(part);
  }

  return tokens.join(" ");
}

function buildScanMeta(
  detection: CardSightDetection,
  query: string,
  response: CardSightIdentifyResponse,
): CardScanMeta {
  const { card } = detection;
  return {
    query,
    requestId: response.requestId,
    confidence: detection.confidence,
    detectedName: card.name,
    detectedNumber: card.number,
    detectedSet: card.setName ?? card.releaseName,
    messages: response.messages,
  };
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

  const query = buildScanSearchQuery(primary);
  if (!query) {
    return { error: "SCAN_NO_CARD" };
  }

  const searchPage = await searchCards(query, locale, searchParams);
  return {
    ...searchPage,
    scan: buildScanMeta(primary, query, identifyResponse),
  };
}
