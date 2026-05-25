export type SetSortInput = {
  releaseDate: string | null;
};

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

  return Array.from(groups.entries()).sort(([, setsA], [, setsB]) =>
    compareReleaseDateDesc(maxReleaseDate(setsA), maxReleaseDate(setsB)),
  );
}

export function sortSetsForDisplay<T extends SetSortInput>(sets: T[]): T[] {
  return [...sets].sort(compareSetsForDisplay);
}
