import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureCardImage } from "@/lib/image-storage";
import type { UiLocale } from "@/lib/i18n/locale";

export async function serveCardImageResponse(
  request: Request,
  cardId: string,
  locale: UiLocale,
): Promise<Response> {
  const { buffer } = await ensureCardImage(cardId, locale);

  if (!buffer) {
    return NextResponse.json({ error: "Bild nicht im Cache." }, { status: 404 });
  }

  const etag = `"${createHash("sha1").update(buffer).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=604800, must-revalidate",
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=604800, must-revalidate",
      ETag: etag,
    },
  });
}
