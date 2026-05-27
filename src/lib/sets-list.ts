export type SetSummary = {
  id: string;
  name: string;
  officialCode: string | null;
};

export type SetListEntry = SetSummary & {
  seriesName: string;
  releaseDate: string | null;
  cardsSyncedAt: string | null;
  cardCount: number;
  hasCollection: boolean;
};

export function areSetListsEqual(
  left: SetListEntry[],
  right: SetListEntry[],
): boolean {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.officialCode !== b.officialCode ||
      a.seriesName !== b.seriesName ||
      a.releaseDate !== b.releaseDate ||
      a.cardsSyncedAt !== b.cardsSyncedAt ||
      a.cardCount !== b.cardCount ||
      a.hasCollection !== b.hasCollection
    ) {
      return false;
    }
  }

  return true;
}
