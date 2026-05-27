export function extractSetIdFromCardId(cardId: string): string {
  const separator = cardId.lastIndexOf("-");
  return separator > 0 ? cardId.slice(0, separator) : cardId;
}

export function extractLocalIdFromCardId(cardId: string): string {
  const separator = cardId.lastIndexOf("-");
  return separator > 0 ? cardId.slice(separator + 1) : cardId;
}
