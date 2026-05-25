"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import {
  clearSavedScrollPosition,
  restoreScrollPosition,
  scrollMainToTop,
} from "@/components/mobile-scroll-shell";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { SearchBar } from "@/components/search-bar";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { isSearchableQuery } from "@/lib/search";
import { useSearchPageState } from "@/lib/use-search-page-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

type SearchResult = CardDetail & {
  setName: string;
  owned: boolean;
};

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SearchResult>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.number === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.setName === "string" &&
    typeof candidate.owned === "boolean" &&
    Array.isArray(candidate.variants)
  );
}

function parseStoredResults(results: unknown[]): SearchResult[] {
  return results.filter(isSearchResult);
}

export default function SearchPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const {
    query,
    searchAllSets,
    results: storedResults,
    hasMore,
    offset,
    hydrated,
    setQuery,
    setSearchAllSets,
    setResultsState,
    clearStoredState,
  } = useSearchPageState();
  const results = parseStoredResults(storedResults);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);
  const searchRequestIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const initialSearchHandledRef = useRef(false);
  const offsetRef = useRef(offset);
  const resultsRef = useRef(results);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    offsetRef.current = offset;
    resultsRef.current = results;
  }, [offset, results]);

  const hasActiveSearch =
    query.trim().length > 0 || results.length > 0 || searchAllSets;

  const loadPage = useCallback(
    async (reset: boolean, searchQuery: string, allSets: boolean) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        searchRequestIdRef.current += 1;
        setResultsState({ results: [], hasMore: false, offset: 0 });
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: String(PAGE_SIZE),
          offset: String(reset ? 0 : offsetRef.current),
        });
        if (allSets) {
          params.set("scope", "all");
        }
        const response = await fetch(
          apiUrl(`/api/cards/search?${params}`, locale),
        );
        const payload = await response.json();
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        const newResults: SearchResult[] = payload.results ?? [];
        const currentOffset = reset ? 0 : offsetRef.current;
        const nextResults = reset
          ? newResults
          : [...resultsRef.current, ...newResults];
        const nextOffset = currentOffset + newResults.length;

        setResultsState({
          results: nextResults,
          hasMore: Boolean(payload.hasMore),
          offset: nextOffset,
        });
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [locale, setResultsState],
  );

  const resetSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    clearStoredState();
    setLoading(false);
    setLoadingMore(false);
    setSelectedCard(null);
    setOpen(false);
    clearSavedScrollPosition("/search");
    scrollMainToTop();
  }, [clearStoredState, setOpen]);

  useEffect(() => {
    if (!hydrated || initialSearchHandledRef.current) {
      return;
    }

    initialSearchHandledRef.current = true;
    if (isSearchableQuery(query)) {
      skipNextSearchRef.current = true;
    }
  }, [hydrated, query]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      if (skipNextSearchRef.current) {
        skipNextSearchRef.current = false;
        return;
      }

      if (isSearchableQuery(query)) {
        void loadPage(true, query, searchAllSets);
      } else {
        searchRequestIdRef.current += 1;
        setResultsState({ results: [], hasMore: false, offset: 0 });
        setLoading(false);
        setLoadingMore(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hydrated, query, searchAllSets, loadPage, setResultsState]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(false, query, searchAllSets);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, query, searchAllSets, loadPage, results.length]);

  useLayoutEffect(() => {
    if (loading || loadingMore || !isSearchableQuery(query)) {
      return;
    }
    restoreScrollPosition("/search");
  }, [loading, loadingMore, query, results.length]);

  return (
    <MobilePage>
      <MobilePageHeader
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <div className="space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={() => void loadPage(true, query, searchAllSets)}
          onClear={resetSearch}
          showClear={hasActiveSearch}
        />
        <button
          type="button"
          onClick={() => setSearchAllSets(!searchAllSets)}
          className={cn(
            "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            searchAllSets
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
              : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
          )}
        >
          {t("search.allSetsButton")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">{t("search.loading")}</p>
      ) : null}

      {!loading && isSearchableQuery(query) && results.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("search.noResults")}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {results.map((card) => (
          <CardTile
            key={card.id}
            compact
            card={{
              id: card.id,
              number: card.number,
              name: card.name,
              setId: card.setId,
              imageUrl: card.imageUrl,
              remoteImageUrl: card.imageUrl,
              setName: card.setName,
              officialCode: card.officialCode,
              owned: card.owned,
              price: card.variants.find((variant) => variant.price != null)?.price,
            }}
            onClick={() => {
              setSelectedCard(card);
              setOpen(true);
            }}
          />
        ))}
      </div>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="py-4 text-center text-sm text-zinc-500"
        >
          {loadingMore ? t("collection.loadingMore") : null}
        </div>
      ) : null}

      <CardModal
        key={selectedCard?.id ?? "closed"}
        card={selectedCard}
        open={open}
        onClose={() => setOpen(false)}
      />
    </MobilePage>
  );
}
