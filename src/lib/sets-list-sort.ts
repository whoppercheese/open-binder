export type SetSortInput = {
  releaseDate: string | null;
  cardsSyncedAt: string | null;
  progress: {
    owned: number;
    total: number;
    percent: number;
  } | null;
};

export function getSetSortTier(set: SetSortInput): number {
  const owned = set.progress?.owned ?? 0;
  if (owned > 0) {
    return 0;
  }
  if (set.cardsSyncedAt != null) {
    return 1;
  }
  return 2;
}

export function compareReleaseDateDesc(
  left: string | null,
  right: string | null,
): number {
  if (left === right) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return right.localeCompare(left);
}

export function compareSetsForDisplay(
  left: SetSortInput,
  right: SetSortInput,
): number {
  const tierLeft = getSetSortTier(left);
  const tierRight = getSetSortTier(right);
  if (tierLeft !== tierRight) {
    return tierLeft - tierRight;
  }

  if (tierLeft === 0) {
    const percentDiff =
      (right.progress?.percent ?? 0) - (left.progress?.percent ?? 0);
    if (percentDiff !== 0) {
      return percentDiff;
    }

    const ownedDiff =
      (right.progress?.owned ?? 0) - (left.progress?.owned ?? 0);
    if (ownedDiff !== 0) {
      return ownedDiff;
    }
  }

  return compareReleaseDateDesc(left.releaseDate, right.releaseDate);
}

function maxReleaseDate(sets: SetSortInput[]): string | null {
  let max: string | null = null;
  for (const set of sets) {
    if (set.releaseDate == null) {
      continue;
    }
    if (max == null || set.releaseDate > max) {
      max = set.releaseDate;
    }
  }
  return max;
}

export function groupSetsBySeries<T extends SetSortInput & { seriesName: string }>(
  sets: T[],
  otherSeriesLabel: string,
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();

  for (const set of sets) {
    const series = set.seriesName || otherSeriesLabel;
    const existing = groups.get(series);
    if (existing) {
      existing.push(set);
    } else {
      groups.set(series, [set]);
    }
  }

  for (const seriesSets of groups.values()) {
    seriesSets.sort(compareSetsForDisplay);
  }

  return Array.from(groups.entries()).sort(([, setsA], [, setsB]) => {
    const collectionA = setsA.some((set) => (set.progress?.owned ?? 0) > 0);
    const collectionB = setsB.some((set) => (set.progress?.owned ?? 0) > 0);
    if (collectionA !== collectionB) {
      return collectionA ? -1 : 1;
    }

    return compareReleaseDateDesc(
      maxReleaseDate(setsA),
      maxReleaseDate(setsB),
    );
  });
}

export function sortSetsForDisplay<T extends SetSortInput>(sets: T[]): T[] {
  return [...sets].sort(compareSetsForDisplay);
}
