import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/lib/i18n/server";
import { readSetImage, type SetImageKind } from "@/lib/image-storage";

function parseKind(value: string): SetImageKind | null {
  if (value === "logo" || value === "symbol") {
    return value;
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ setId: string; kind: string }> },
) {
  const { t } = getRequestTranslator(request);
  const { setId, kind: rawKind } = await context.params;
  const kind = parseKind(rawKind);

  if (!kind) {
    return NextResponse.json(
      { error: t("errors.api.setImageInvalidKind") },
      { status: 400 },
    );
  }

  const image = await readSetImage(decodeURIComponent(setId), kind);

  if (!image) {
    return NextResponse.json(
      { error: t("errors.api.setImageNotCached") },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=86400",
      ETag: `"${createHash("sha1").update(image.buffer).digest("hex")}"`,
    },
  });
}
