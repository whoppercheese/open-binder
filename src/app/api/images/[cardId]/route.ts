import { NextResponse } from "next/server";
import { readCardImage } from "@/lib/image-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await context.params;
  const buffer = await readCardImage(decodeURIComponent(cardId));

  if (!buffer) {
    return NextResponse.json({ error: "Bild nicht im Cache." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
