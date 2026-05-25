"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { SearchBar } from "@/components/search-bar";
import { SetListItem } from "@/components/set-list-item";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { formatSyncJobMessage } from "@/lib/sync-job-display";
import {
  areSetListsEqual,
  type SetListEntry,
} from "@/lib/sets-list";
import { groupSetsBySeries } from "@/lib/sets-list-sort";
import type { ActiveSetCardsJob } from "@/jobs/sync-job-utils";
import { cn } from "@/lib/utils";

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

const SETS_PAGE_STATE_KEY = "sets-page-state";

type SetListFilter = "downloaded" | "collection";

type SetsPageState = {
  query: string;
  filters: SetListFilter[];
};

const DEFAULT_PAGE_STATE: SetsPageState = {
  query: "",
  filters: [],
};

function parseSavedState(raw: string | null): SetsPageState {
  if (!raw) {
    return DEFAULT_PAGE_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as {
      query?: string;
      filters?: unknown;
    };
    const filters = Array.isArray(parsed.filters)
      ? parsed.filters.filter(
          (filter): filter is SetListFilter =>
            filter === "downloaded" || filter === "collection",
        )
      : [];

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      filters,
    };
  } catch {
    return DEFAULT_PAGE_STATE;
  }
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}

function matchesSetQuery(set: SetListEntry, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    set.name.toLowerCase().includes(normalized) ||
    (set.officialCode?.toLowerCase().includes(normalized) ?? false)
  );
}

function matchesSetFilters(
  set: SetListEntry,
  filters: ReadonlySet<SetListFilter>,
) {
  if (filters.size === 0) {
    return true;
  }

  if (filters.has("downloaded") && set.cardsSyncedAt == null) {
    return false;
  }

  if (filters.has("collection") && (set.progress?.owned ?? 0) <= 0) {
    return false;
  }

  return true;
}

function toggleFilter(
  current: SetListFilter[],
  filter: SetListFilter,
): SetListFilter[] {
  return current.includes(filter)
    ? current.filter((entry) => entry !== filter)
    : [...current, filter];
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
  const { locale } = useLocale();
  const t = useTranslations();
  const [sets, setSets] = useState(initialSets);
  const setsRef = useRef(initialSets);
  const knownSetCountRef = useRef(initialSets.length);
  const [query, setQuery] = useState(DEFAULT_PAGE_STATE.query);
  const [filters, setFilters] = useState<SetListFilter[]>(
    DEFAULT_PAGE_STATE.filters,
  );
  const pageStateRestoredRef = useRef(false);
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

  useEffect(() => {
    const saved = parseSavedState(
      sessionStorage.getItem(SETS_PAGE_STATE_KEY),
    );
    setQuery(saved.query);
    setFilters(saved.filters);
    pageStateRestoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!pageStateRestoredRef.current) {
      return;
    }

    sessionStorage.setItem(
      SETS_PAGE_STATE_KEY,
      JSON.stringify({ query, filters }),
    );
  }, [query, filters]);

  const activeFilters = useMemo(() => new Set(filters), [filters]);
  const hasActiveFilters = filters.length > 0;

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
    const response = await fetch(apiUrl("/api/sets/list", locale));
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
  }, [locale]);

  const runPollRef = useRef<(() => Promise<void>) | null>(null);

  const runPoll = useCallback(async () => {
    const payload = await loadActiveJobs();
    if (!payload) {
      pollTimeoutRef.current = setTimeout(() => {
        void runPollRef.current?.();
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
        void runPollRef.current?.();
      }, 3000);
    }
  }, [loadActiveJobs, loadSetsList, stopPolling]);

  useEffect(() => {
    runPollRef.current = runPoll;
  }, [runPoll]);

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
    () =>
      sets.filter(
        (set) =>
          matchesSetQuery(set, query) && matchesSetFilters(set, activeFilters),
      ),
    [sets, query, activeFilters],
  );

  const grouped = useMemo(
    () => groupSetsBySeries(filteredSets, t("sets.seriesOther")),
    [filteredSets, t],
  );

  async function handleLoadCards(setId: string) {
    setLoadError(null);
    setLoadingSetId(setId);

    const setName = sets.find((set) => set.id === setId)?.name ?? setId;
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
      setLoadError(t("errors.cardSyncStartFailed"));
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
  const hasSearch = trimmedQuery.length > 0;
  const hasActiveSearch = hasSearch || hasActiveFilters;

  function resetSearch() {
    setQuery("");
    setFilters([]);
  }

  const subtitle =
    hasSearch || hasActiveFilters
      ? t.plural("sets.subtitleFiltered", sets.length, {
          filtered: filteredSets.length,
          total: sets.length,
        })
      : t.plural("sets.subtitleBrowse", sets.length, { count: sets.length });

  return (
    <MobilePage>
      <MobilePageHeader title={t("sets.title")} subtitle={subtitle} />

      {syncIndicator ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-400" />
          <div className="min-w-0 space-y-1">
            {syncIndicator.catalogActive && !syncIndicator.runningSetName ? (
              <p className="font-medium">
                {syncIndicator.catalogStatus === "running"
                  ? t("sets.catalogSyncRunning")
                  : t("sets.catalogSyncPending")}
              </p>
            ) : null}
            {syncIndicator.runningSetName ? (
              <p className="font-medium">
                {t("sets.cardsLoadingNamed", {
                  setName: syncIndicator.runningSetName,
                })}
              </p>
            ) : syncIndicator.pendingCount > 0 ? (
              <p className="font-medium">
                {t.plural("sets.setsInQueue", syncIndicator.pendingCount)}
              </p>
            ) : null}
            {syncIndicator.runningMessage ? (
              <p className="truncate text-xs text-emerald-200/70">
                {formatSyncJobMessage(syncIndicator.runningMessage, t)}
              </p>
            ) : null}
            {syncIndicator.runningSetName && syncIndicator.pendingCount > 0 ? (
              <p className="text-xs text-emerald-200/70">
                {t.plural("sets.additionalSetsWaiting", syncIndicator.pendingCount)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {sets.length > 0 ? (
        <div className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            onClear={resetSearch}
            showClear={hasActiveSearch}
            placeholder={t("sets.searchPlaceholder")}
          />
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={filters.includes("downloaded")}
              onClick={() =>
                setFilters((current) => toggleFilter(current, "downloaded"))
              }
            >
              {t("sets.filterDownloaded")}
            </FilterChip>
            <FilterChip
              active={filters.includes("collection")}
              onClick={() =>
                setFilters((current) => toggleFilter(current, "collection"))
              }
            >
              {t("sets.filterCollection")}
            </FilterChip>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : null}

      {sets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {t("sets.emptyNoSets")}
        </div>
      ) : null}

      {sets.length > 0 && (hasSearch || hasActiveFilters) && filteredSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {hasSearch && hasActiveFilters
            ? t("sets.emptySearchAndFilter")
            : hasSearch
              ? t("sets.emptySearch")
              : t("sets.emptyFilter")}
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
                  name={set.name}
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
    </MobilePage>
  );
}
