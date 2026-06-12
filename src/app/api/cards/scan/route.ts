import { NextResponse } from "next/server";
import { isCardSightConfigured } from "@/lib/cardsight.server";
import { scanCardAndSearch } from "@/lib/card-scan.server";
import { getRequestTranslator } from "@/lib/i18n/server";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET() {
  return NextResponse.json({ enabled: isCardSightConfigured() });
}

export async function POST(request: Request) {
  try {
    if (!isCardSightConfigured()) {
      return NextResponse.json(
        { errorCode: "SCAN_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const { locale } = getRequestTranslator(request);
    const { searchParams } = new URL(request.url);

    const formData = await request.formData();
    const imageEntry = formData.get("image");
    if (!(imageEntry instanceof File)) {
      return NextResponse.json(
        { errorCode: "SCAN_IMAGE_REQUIRED" },
        { status: 400 },
      );
    }

    if (imageEntry.size <= 0 || imageEntry.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { errorCode: "SCAN_IMAGE_INVALID" },
        { status: 400 },
      );
    }

    const mimeType = imageEntry.type || "image/jpeg";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { errorCode: "SCAN_IMAGE_INVALID" },
        { status: 400 },
      );
    }

    const imageBytes = Buffer.from(await imageEntry.arrayBuffer());
    const result = await scanCardAndSearch(
      imageBytes,
      mimeType,
      locale,
      searchParams,
    );

    if ("error" in result) {
      const status =
        result.error === "SCAN_UPSTREAM_AUTH"
          ? 502
          : result.error === "SCAN_UPSTREAM_RATE_LIMIT"
            ? 429
            : result.error === "SCAN_NO_CARD"
              ? 422
              : 500;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ errorCode: "SCAN_FAILED" }, { status: 500 });
  }
}
