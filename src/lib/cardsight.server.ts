import "server-only";

const DEFAULT_BASE_URL = "https://api.cardsight.ai";
const IDENTIFY_PATH = "/v1/identify/card/pokemon";

export type CardSightConfidence = "High" | "Medium" | "Low" | string;

export type CardSightFieldValue = {
  key?: string;
  value?: string;
};

export type CardSightCard = {
  id?: string;
  setId?: string;
  name?: string;
  number?: string;
  setName?: string;
  releaseName?: string;
  year?: string;
  fields?: CardSightFieldValue[];
};

export type CardSightDetection = {
  confidence: CardSightConfidence;
  card: CardSightCard;
};

export type CardSightMessage = {
  type?: string;
  message?: string;
};

export type CardSightIdentifyResponse = {
  success?: boolean;
  requestId?: string;
  detections?: CardSightDetection[];
  processingTime?: number;
  messages?: CardSightMessage[];
};

export type CardSightErrorCode =
  | "SCAN_UPSTREAM_AUTH"
  | "SCAN_UPSTREAM_RATE_LIMIT"
  | "SCAN_FAILED";

export class CardSightApiError extends Error {
  readonly code: CardSightErrorCode;
  readonly status: number;

  constructor(code: CardSightErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.name = "CardSightApiError";
    this.code = code;
    this.status = status;
  }
}

function getBaseUrl(): string {
  return process.env.CARDSIGHT_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function getApiKey(): string | null {
  const key = process.env.CARDSIGHT_API_KEY?.trim();
  return key || null;
}

export function isCardSightConfigured(): boolean {
  return getApiKey() != null;
}

export async function identifyPokemonCard(
  imageBytes: Buffer,
  mimeType: string,
): Promise<CardSightIdentifyResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new CardSightApiError("SCAN_UPSTREAM_AUTH", 503, "Missing API key");
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBytes)], { type: mimeType });
  formData.append("image", blob, "scan.jpg");

  const response = await fetch(`${getBaseUrl()}${IDENTIFY_PATH}`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    throw new CardSightApiError(
      "SCAN_UPSTREAM_AUTH",
      response.status,
      "Invalid API key",
    );
  }

  if (response.status === 429) {
    throw new CardSightApiError(
      "SCAN_UPSTREAM_RATE_LIMIT",
      response.status,
      "Rate limit exceeded",
    );
  }

  if (!response.ok) {
    throw new CardSightApiError(
      "SCAN_FAILED",
      response.status,
      `CardSight request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as CardSightIdentifyResponse;
  return payload;
}
