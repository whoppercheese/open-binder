export type SetSummary = {
  id: string;
  name: string;
  officialCode: string | null;
};

export type SetListEntry = SetSummary & {
  seriesName: string;
  releaseDate: string | null;
  cardsSyncedAt: string | null;
  progress: {
    owned: number;
    total: number;
    percent: number;
    hasCollection?: boolean;
  } | null;
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
      a.progress?.owned !== b.progress?.owned ||
      a.progress?.total !== b.progress?.total ||
      a.progress?.percent !== b.progress?.percent
    ) {
      return false;
    }
  }

  return true;
}
