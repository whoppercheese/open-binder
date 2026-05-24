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
import { cn } from "@/lib/utils";

type SearchResult = CardDetail & {
  setName: string;
  owned: boolean;
};

const SEARCH_PAGE_STATE_KEY = "search-page-state";

type SearchPageState = {
  query: string;
  searchAllSets: boolean;
  results: SearchResult[];
};

function readSavedState(): SearchPageState {
  if (typeof window === "undefined") {
    return { query: "", searchAllSets: false, results: [] };
  }

  try {
    const saved = sessionStorage.getItem(SEARCH_PAGE_STATE_KEY);
    if (!saved) {
      return { query: "", searchAllSets: false, results: [] };
    }

    const parsed = JSON.parse(saved) as Partial<SearchPageState>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      searchAllSets: parsed.searchAllSets === true,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  } catch {
    return { query: "", searchAllSets: false, results: [] };
  }
}

export default function SearchPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const savedState = readSavedState();
  const [query, setQuery] = useState(savedState.query);
  const [searchAllSets, setSearchAllSets] = useState(savedState.searchAllSets);
  const [results, setResults] = useState<SearchResult[]>(savedState.results);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);
  const skipNextSearchRef = useRef(isSearchableQuery(savedState.query));

  const hasActiveSearch =
    query.trim().length > 0 || results.length > 0 || searchAllSets;

  const runSearch = useCallback(async (searchQuery: string, allSets: boolean) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const scope = allSets ? "&scope=all" : "";
      const response = await fetch(
        apiUrl(
          `/api/cards/search?q=${encodeURIComponent(searchQuery.trim())}${scope}`,
          locale,
        ),
      );
      const payload = await response.json();
      setResults(payload.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const resetSearch = useCallback(() => {
    skipNextSearchRef.current = false;
    setQuery("");
    setSearchAllSets(false);
    setResults([]);
    setSelectedCard(null);
    setOpen(false);
    sessionStorage.removeItem(SEARCH_PAGE_STATE_KEY);
    clearSavedScrollPosition("/search");
    scrollMainToTop();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      SEARCH_PAGE_STATE_KEY,
      JSON.stringify({ query, searchAllSets, results }),
    );
  }, [query, searchAllSets, results]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (skipNextSearchRef.current) {
        skipNextSearchRef.current = false;
        return;
      }

      if (isSearchableQuery(query)) {
        void runSearch(query, searchAllSets);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchAllSets, runSearch]);

  useLayoutEffect(() => {
    if (!loading && isSearchableQuery(query)) {
      restoreScrollPosition("/search");
    }
  }, [loading, query, results.length]);

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
          onSubmit={() => void runSearch(query, searchAllSets)}
          onClear={resetSearch}
          showClear={hasActiveSearch}
        />
        <button
          type="button"
          onClick={() => setSearchAllSets((current) => !current)}
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
              remoteImageUrl: searchAllSets ? card.imageUrl : null,
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

      <CardModal
        key={selectedCard?.id ?? "closed"}
        card={selectedCard}
        open={open}
        onClose={() => setOpen(false)}
      />
    </MobilePage>
  );
}
