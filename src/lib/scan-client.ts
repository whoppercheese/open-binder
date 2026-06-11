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
  detectedSetCode?: string;
  detectedNumber?: string;
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

export async function scanCard(
  file: File,
  locale: UiLocale,
): Promise<ScanCardResult> {
  const path = "/api/cards/scan";

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
