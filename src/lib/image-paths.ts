export function getCardImageApiPath(cardId: string): string {
  return `/api/images/${encodeURIComponent(cardId)}`;
}
