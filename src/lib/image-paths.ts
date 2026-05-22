import type { SetImageKind } from "@/lib/image-storage";

export function getCardImageApiPath(cardId: string): string {
  return `/api/images/${encodeURIComponent(cardId)}`;
}

export function getSetImageApiPath(setId: string, kind: SetImageKind): string {
  return `/api/set-images/${encodeURIComponent(setId)}/${kind}`;
}
