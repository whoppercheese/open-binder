"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { SetListItem } from "@/components/set-list-item";
import {
  areSetListsEqual,
  type SetListEntry,
} from "@/lib/sets-list";

type ActiveSetCardsJob = {
  id: string;
  setId: string;
  setName: string;
  status: string;
  message: string | null;
};

type ActiveCatalogJob = {
  id: string;
  status: string;
  message: string | null;
};

type ActiveSyncPayload = {
  setCount: number;
  setCardsJobs: ActiveSetCardsJob[];
  catalogJob: ActiveCatalogJob | null;
};

type SetsPageContentProps = {
  initialSets: SetListEntry[];
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

function activeJobsEqual(
  a: ActiveSetCardsJob[],
  b: ActiveSetCardsJob[],
) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id ||
      left.setId !== right.setId ||
      left.status !== right.status ||
      left.message !== right.message
    ) {
      return false;
    }
  }

  return true;
}

function catalogJobEqual(
  a: ActiveCatalogJob | null,
  b: ActiveCatalogJob | null,
) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }

  return (
    a.id === b.id && a.status === b.status && a.message === b.message
  );
}

export function SetsPageContent({ initialSets }: SetsPageContentProps) {
  const [sets, setSets] = useState(initialSets);
  const setsRef = useRef(initialSets);
  const knownSetCountRef = useRef(initialSets.length);
  const [query, setQuery] = useState("");
  const [activeJobs, setActiveJobs] = useState<ActiveSetCardsJob[]>([]);
  const [catalogJob, setCatalogJob] = useState<ActiveCatalogJob | null>(null);
  const [loadingSetId, setLoadingSetId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadActiveJobsRef = useRef(false);
  const previousSetCardsJobCountRef = useRef(0);

  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const loadActiveJobs = useCallback(async (): Promise<ActiveSyncPayload | null> => {
    const response = await fetch("/api/sync/active");
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ActiveSyncPayload;
    const nextJobs = payload.setCardsJobs ?? [];
    const nextCatalogJob = payload.catalogJob ?? null;

    setActiveJobs((current) =>
      activeJobsEqual(current, nextJobs) ? current : nextJobs,
    );
    setCatalogJob((current) =>
      catalogJobEqual(current, nextCatalogJob) ? current : nextCatalogJob,
    );

    return payload;
  }, []);

  const loadSetsList = useCallback(async () => {
    const response = await fetch("/api/sets/list");
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as { sets: SetListEntry[] };
    const nextSets = payload.sets ?? [];

    if (!areSetListsEqual(setsRef.current, nextSets)) {
      setSets(nextSets);
    }

    knownSetCountRef.current = nextSets.length;
    return true;
  }, []);

  const runPoll = useCallback(async () => {
    const payload = await loadActiveJobs();
    if (!payload) {
      pollTimeoutRef.current = setTimeout(() => {
        void runPoll();
      }, 3000);
      return;
    }

    const setCardsJobCount = payload.setCardsJobs?.length ?? 0;
    const hasActiveJobs = setCardsJobCount > 0 || payload.catalogJob != null;
    const setCountIncreased = payload.setCount > knownSetCountRef.current;
    const setCardsJobFinished =
      setCardsJobCount < previousSetCardsJobCountRef.current;
    const allJobsFinished = hadActiveJobsRef.current && !hasActiveJobs;

    if (
      setCountIncreased ||
      setCardsJobFinished ||
      allJobsFinished ||
      (knownSetCountRef.current === 0 && payload.setCount > 0)
    ) {
      await loadSetsList();
    }

    hadActiveJobsRef.current = hasActiveJobs;
    previousSetCardsJobCountRef.current = setCardsJobCount;

    const isIdle =
      !hasActiveJobs && payload.setCount === knownSetCountRef.current;

    if (!isIdle) {
      stopPolling();
      pollTimeoutRef.current = setTimeout(() => {
        void runPoll();
      }, 3000);
    }
  }, [loadActiveJobs, loadSetsList, stopPolling]);

  useEffect(() => {
    void runPoll();

    return () => {
      stopPolling();
    };
  }, [runPoll, stopPolling]);

  const activeJobBySetId = useMemo(() => {
    const map = new Map<string, ActiveSetCardsJob>();
    for (const job of activeJobs) {
      if (!map.has(job.setId)) {
        map.set(job.setId, job);
      }
    }
    return map;
  }, [activeJobs]);

  const syncIndicator = useMemo(() => {
    const runningJob = activeJobs.find((job) => job.status === "running");
    const pendingCount = activeJobs.filter(
      (job) => job.status === "pending",
    ).length;
    const catalogActive =
      catalogJob?.status === "running" || catalogJob?.status === "pending";

    if (!runningJob && pendingCount === 0 && !catalogActive) {
      return null;
    }

    return {
      runningSetName: runningJob?.setName ?? null,
      runningMessage: runningJob?.message ?? catalogJob?.message ?? null,
      pendingCount,
      catalogActive,
      catalogStatus: catalogJob?.status ?? null,
    };
  }, [activeJobs, catalogJob]);

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

  async function handleLoadCards(setId: string) {
    setLoadError(null);
    setLoadingSetId(setId);

    const setName = sets.find((set) => set.id === setId)?.nameDe ?? setId;
    setActiveJobs((current) => {
      if (current.some((job) => job.setId === setId)) {
        return current;
      }

      return [
        ...current,
        {
          id: "optimistic",
          setId,
          setName,
          status: "pending",
          message: null,
        },
      ];
    });

    const response = await fetch("/api/sync/set-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setLoadError(
        (body.error as string) ?? "Karten-Sync konnte nicht gestartet werden.",
      );
      setActiveJobs((current) => current.filter((job) => job.setId !== setId));
    } else {
      await loadActiveJobs();
      stopPolling();
      pollTimeoutRef.current = setTimeout(() => {
        void runPoll();
      }, 0);
    }

    setLoadingSetId(null);
  }

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

      {syncIndicator ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-400" />
          <div className="min-w-0 space-y-1">
            {syncIndicator.catalogActive && !syncIndicator.runningSetName ? (
              <p className="font-medium">
                {syncIndicator.catalogStatus === "running"
                  ? "Set-Liste wird synchronisiert…"
                  : "Set-Liste wartet in der Queue…"}
              </p>
            ) : null}
            {syncIndicator.runningSetName ? (
              <p className="font-medium">
                Karten werden geladen: {syncIndicator.runningSetName}
              </p>
            ) : syncIndicator.pendingCount > 0 ? (
              <p className="font-medium">
                {syncIndicator.pendingCount}{" "}
                {syncIndicator.pendingCount === 1 ? "Set" : "Sets"} in der
                Warteschlange
              </p>
            ) : null}
            {syncIndicator.runningMessage ? (
              <p className="truncate text-xs text-emerald-200/70">
                {syncIndicator.runningMessage}
              </p>
            ) : null}
            {syncIndicator.runningSetName && syncIndicator.pendingCount > 0 ? (
              <p className="text-xs text-emerald-200/70">
                {syncIndicator.pendingCount}{" "}
                {syncIndicator.pendingCount === 1
                  ? "weiteres Set wartet"
                  : "weitere Sets warten"}{" "}
                in der Queue
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {sets.length > 0 ? (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Name oder Kürzel (z.B. Base Set, BS)"
        />
      ) : null}

      {loadError ? (
        <p className="text-sm text-amber-400">{loadError}</p>
      ) : null}

      {sets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Noch keine Sets vorhanden. Der Worker lädt die Set-Liste beim Start.
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
            {seriesSets.map((set) => {
              const activeJob = activeJobBySetId.get(set.id) ?? null;
              const cardsSynced = set.cardsSyncedAt != null;
              const syncState =
                activeJob?.status === "running"
                  ? "running"
                  : activeJob?.status === "pending"
                    ? "pending"
                    : "idle";

              return (
                <SetListItem
                  key={set.id}
                  id={set.id}
                  nameDe={set.nameDe}
                  officialCode={set.officialCode}
                  cardsSynced={cardsSynced}
                  syncStatus={syncState}
                  syncMessage={activeJob?.message}
                  owned={set.progress?.owned}
                  total={set.progress?.total}
                  percent={set.progress?.percent}
                  onLoadCards={handleLoadCards}
                  loadingCards={loadingSetId === set.id}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
