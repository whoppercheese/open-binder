import { serveCardImageResponse } from "@/lib/card-image-api.server";
import { getLocaleFromRequest } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await context.params;
  const locale = getLocaleFromRequest(request);
  return serveCardImageResponse(request, decodeURIComponent(cardId), locale);
}
