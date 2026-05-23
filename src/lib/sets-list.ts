export type SetListEntry = {
  id: string;
  nameDe: string;
  officialCode: string | null;
  seriesName: string;
  cardsSyncedAt: string | null;
  progress: {
    owned: number;
    total: number;
    percent: number;
  } | null;
};

export function areSetListsEqual(a: SetListEntry[], b: SetListEntry[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (
      left.id !== right.id ||
      left.nameDe !== right.nameDe ||
      left.officialCode !== right.officialCode ||
      left.seriesName !== right.seriesName ||
      left.cardsSyncedAt !== right.cardsSyncedAt ||
      left.progress?.owned !== right.progress?.owned ||
      left.progress?.total !== right.progress?.total ||
      left.progress?.percent !== right.progress?.percent
    ) {
      return false;
    }
  }

  return true;
}
