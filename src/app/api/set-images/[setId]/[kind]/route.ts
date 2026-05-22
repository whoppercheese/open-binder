import { NextResponse } from "next/server";
import { readSetImage, type SetImageKind } from "@/lib/image-storage";

function parseKind(value: string): SetImageKind | null {
  if (value === "logo" || value === "symbol") {
    return value;
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ setId: string; kind: string }> },
) {
  const { setId, kind: rawKind } = await context.params;
  const kind = parseKind(rawKind);

  if (!kind) {
    return NextResponse.json({ error: "Ungültiger Bildtyp." }, { status: 400 });
  }

  const buffer = await readSetImage(decodeURIComponent(setId), kind);

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
