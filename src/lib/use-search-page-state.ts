"use client";

import { useCallback, useSyncExternalStore } from "react";

const SEARCH_PAGE_STATE_KEY = "search-page-state";

export type SearchPageState = {
  query: string;
  searchAllSets: boolean;
};

type SearchUiState = SearchPageState & {
  hydrated: boolean;
};

export const DEFAULT_SEARCH_PAGE_STATE: SearchPageState = {
  query: "",
  searchAllSets: false,
};

const SSR_SEARCH_UI_STATE: SearchUiState = {
  ...DEFAULT_SEARCH_PAGE_STATE,
  hydrated: false,
};

const listeners = new Set<() => void>();
let cachedState: SearchUiState | null = null;

function parseSavedState(raw: string | null): SearchPageState {
  if (!raw) {
    return DEFAULT_SEARCH_PAGE_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SearchPageState & { results?: unknown }>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      searchAllSets: parsed.searchAllSets === true,
    };
  } catch {
    return DEFAULT_SEARCH_PAGE_STATE;
  }
}

function readStoredState(): SearchUiState {
  if (typeof window === "undefined") {
    return SSR_SEARCH_UI_STATE;
  }

  return {
    ...parseSavedState(sessionStorage.getItem(SEARCH_PAGE_STATE_KEY)),
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
    }),
  );
}

function updateState(patch: Partial<SearchPageState>) {
  const nextState: SearchUiState = {
    ...(cachedState ?? readStoredState()),
    ...patch,
    hydrated: true,
  };
  cachedState = nextState;
  persistState(nextState);
  emitChange();
}

export function useSearchPageState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setQuery = useCallback((query: string) => {
    updateState({ query });
  }, []);

  const setSearchAllSets = useCallback((searchAllSets: boolean) => {
    updateState({ searchAllSets });
  }, []);

  const clearStoredState = useCallback(() => {
    cachedState = { ...DEFAULT_SEARCH_PAGE_STATE, hydrated: true };
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SEARCH_PAGE_STATE_KEY);
    }
    emitChange();
  }, []);

  return {
    query: state.query,
    searchAllSets: state.searchAllSets,
    hydrated: state.hydrated,
    setQuery,
    setSearchAllSets,
    clearStoredState,
  };
}
