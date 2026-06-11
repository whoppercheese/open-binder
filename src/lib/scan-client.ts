import { apiUrl } from "@/lib/i18n/context";
import type { UiLocale } from "@/lib/i18n/locale";

export type ScanErrorCode =
  | "SCAN_IMAGE_REQUIRED"
  | "SCAN_IMAGE_INVALID"
  | "SCAN_NO_CARD"
  | "SCAN_NOT_CONFIGURED"
  | "SCAN_UPSTREAM_AUTH"
  | "SCAN_UPSTREAM_RATE_LIMIT"
  | "SCAN_FAILED";

export type ScanMessage = {
  type?: string;
  message?: string;
};

export type ScanMeta = {
  query: string;
  requestId?: string;
  confidence?: string;
  detectedName?: string;
  detectedNumber?: string;
  detectedSet?: string;
  messages?: ScanMessage[];
};

export type ScanCardResult = {
  results: unknown[];
  hasMore: boolean;
  total?: number;
  scan: ScanMeta;
};

export class ScanClientError extends Error {
  readonly code: ScanErrorCode;

  constructor(code: ScanErrorCode) {
    super(code);
    this.name = "ScanClientError";
    this.code = code;
  }
}

type ScanCardOptions = {
  scope?: "all";
  collectionId?: string;
};

export async function scanCard(
  file: File,
  locale: UiLocale,
  options: ScanCardOptions = {},
): Promise<ScanCardResult> {
  const params = new URLSearchParams();
  if (options.scope === "all") {
    params.set("scope", "all");
  }
  if (options.collectionId) {
    params.set("collectionId", options.collectionId);
  }

  const query = params.toString();
  const path = query ? `/api/cards/scan?${query}` : "/api/cards/scan";

  const formData = new FormData();
  formData.append("image", file, file.name || "scan.jpg");

  const response = await fetch(apiUrl(path, locale), {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as ScanCardResult & {
    errorCode?: ScanErrorCode;
  };

  if (!response.ok || payload.errorCode) {
    throw new ScanClientError(payload.errorCode ?? "SCAN_FAILED");
  }

  return payload;
}
