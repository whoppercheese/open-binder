import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/lib/i18n/server";
import { readCollectionCoverImage } from "@/lib/image-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ collectionId: string }> },
) {
  const { t } = getRequestTranslator(request);
  const { collectionId } = await context.params;
  const buffer = await readCollectionCoverImage(
    decodeURIComponent(collectionId),
  );

  if (!buffer) {
    return NextResponse.json(
      { error: t("errors.api.collectionCoverNotCached") },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
