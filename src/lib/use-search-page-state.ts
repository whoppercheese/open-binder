"use client";

import { useCallback, useSyncExternalStore } from "react";

const SEARCH_PAGE_STATE_KEY = "search-page-state";

export type SearchPageState = {
  query: string;
  searchAllSets: boolean;
};

export type PersistedSearchResults = {
  results: unknown[];
  hasMore: boolean;
  offset: number;
};

type PersistedSearchPageState = SearchPageState & PersistedSearchResults;

type SearchUiState = PersistedSearchPageState & {
  hydrated: boolean;
};

export const DEFAULT_SEARCH_PAGE_STATE: SearchPageState = {
  query: "",
  searchAllSets: false,
};

export const DEFAULT_PERSISTED_RESULTS: PersistedSearchResults = {
  results: [],
  hasMore: false,
  offset: 0,
};

const SSR_SEARCH_UI_STATE: SearchUiState = {
  ...DEFAULT_SEARCH_PAGE_STATE,
  ...DEFAULT_PERSISTED_RESULTS,
  hydrated: false,
};

const listeners = new Set<() => void>();
let cachedState: SearchUiState | null = null;

export function readPersistedSearchPageState(
  raw: string | null = typeof window === "undefined"
    ? null
    : sessionStorage.getItem(SEARCH_PAGE_STATE_KEY),
): PersistedSearchPageState {
  if (!raw) {
    return { ...DEFAULT_SEARCH_PAGE_STATE, ...DEFAULT_PERSISTED_RESULTS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSearchPageState>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      searchAllSets: parsed.searchAllSets === true,
      results: Array.isArray(parsed.results) ? parsed.results : [],
      hasMore: parsed.hasMore === true,
      offset:
        typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
          ? parsed.offset
          : 0,
    };
  } catch {
    return { ...DEFAULT_SEARCH_PAGE_STATE, ...DEFAULT_PERSISTED_RESULTS };
  }
}

function readStoredState(): SearchUiState {
  if (typeof window === "undefined") {
    return SSR_SEARCH_UI_STATE;
  }

  return {
    ...readPersistedSearchPageState(sessionStorage.getItem(SEARCH_PAGE_STATE_KEY)),
    hydrated: true,
  };
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (typeof window !== "undefined" && cachedState === null) {
    cachedState = readStoredState();
    queueMicrotask(emitChange);
  }

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SearchUiState {
  return cachedState ?? SSR_SEARCH_UI_STATE;
}

function getServerSnapshot(): SearchUiState {
  return SSR_SEARCH_UI_STATE;
}

function persistState(state: SearchUiState) {
  if (typeof window === "undefined" || !state.hydrated) {
    return;
  }

  sessionStorage.setItem(
    SEARCH_PAGE_STATE_KEY,
    JSON.stringify({
      query: state.query,
      searchAllSets: state.searchAllSets,
      results: state.results,
      hasMore: state.hasMore,
      offset: state.offset,
    }),
  );
}

function updateState(
  patch: Partial<SearchPageState>,
  options?: { resetResults?: boolean },
) {
  const current = cachedState ?? readStoredState();
  const resetResults = options?.resetResults ?? false;
  const nextState: SearchUiState = {
    ...current,
    ...patch,
    ...(resetResults ? DEFAULT_PERSISTED_RESULTS : {}),
    hydrated: true,
  };
  cachedState = nextState;
  persistState(nextState);
  emitChange();
}

function updateResults(resultsState: PersistedSearchResults) {
  const nextState: SearchUiState = {
    ...(cachedState ?? readStoredState()),
    ...resultsState,
    hydrated: true,
  };
  cachedState = nextState;
  persistState(nextState);
  emitChange();
}

export function useSearchPageState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setQuery = useCallback((query: string) => {
    const current = cachedState ?? readStoredState();
    updateState({ query }, { resetResults: query !== current.query });
  }, []);

  const setSearchAllSets = useCallback((searchAllSets: boolean) => {
    const current = cachedState ?? readStoredState();
    updateState({ searchAllSets }, { resetResults: searchAllSets !== current.searchAllSets });
  }, []);

  const setResultsState = useCallback((resultsState: PersistedSearchResults) => {
    updateResults(resultsState);
  }, []);

  const clearStoredState = useCallback(() => {
    cachedState = {
      ...DEFAULT_SEARCH_PAGE_STATE,
      ...DEFAULT_PERSISTED_RESULTS,
      hydrated: true,
    };
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SEARCH_PAGE_STATE_KEY);
    }
    emitChange();
  }, []);

  return {
    query: state.query,
    searchAllSets: state.searchAllSets,
    results: state.results,
    hasMore: state.hasMore,
    offset: state.offset,
    hydrated: state.hydrated,
    setQuery,
    setSearchAllSets,
    setResultsState,
    clearStoredState,
  };
}
