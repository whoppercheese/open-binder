"use client";

import { useMemo, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { SetListItem } from "@/components/set-list-item";

export type SetListEntry = {
  id: string;
  nameDe: string;
  officialCode: string | null;
  seriesName: string;
  progress: {
    owned: number;
    total: number;
    percent: number;
  };
};

type SetsPageContentProps = {
  sets: SetListEntry[];
};

function matchesSetQuery(set: SetListEntry, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    set.nameDe.toLowerCase().includes(normalized) ||
    (set.officialCode?.toLowerCase().includes(normalized) ?? false)
  );
}

export function SetsPageContent({ sets }: SetsPageContentProps) {
  const [query, setQuery] = useState("");

  const filteredSets = useMemo(
    () => sets.filter((set) => matchesSetQuery(set, query)),
    [sets, query],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, SetListEntry[]>();

    for (const set of filteredSets) {
      const series = set.seriesName || "Sonstige";
      const existing = groups.get(series);
      if (existing) {
        existing.push(set);
      } else {
        groups.set(series, [set]);
      }
    }

    return Array.from(groups.entries());
  }, [filteredSets]);

  const trimmedQuery = query.trim();
  const subtitle =
    trimmedQuery.length > 0
      ? `${filteredSets.length} von ${sets.length} Sets`
      : `${sets.length} Sets durchsuchen`;

  return (
    <div className="space-y-6 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Sets</h1>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </header>

      {sets.length > 0 ? (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Name oder Kürzel (z.B. Base Set, BS)"
        />
      ) : null}

      {sets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Noch kein Katalog vorhanden. Starte den Katalog-Sync in den
          Einstellungen.
        </div>
      ) : null}

      {sets.length > 0 && trimmedQuery && filteredSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Keine Sets für diese Suche.
        </div>
      ) : null}

      {grouped.map(([series, seriesSets]) => (
        <section key={series} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {series}
          </h2>
          <div className="space-y-3">
            {seriesSets.map((set) => (
              <SetListItem
                key={set.id}
                id={set.id}
                nameDe={set.nameDe}
                officialCode={set.officialCode}
                owned={set.progress.owned}
                total={set.progress.total}
                percent={set.progress.percent}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
