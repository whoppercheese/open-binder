"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { CardDetail } from "@/components/card-modal";
import { BulkAddToChecklistSheet } from "@/components/bulk-add-to-checklist-sheet";
import { SetCardPreviewModal } from "@/components/set-card-preview-modal";
import { CardGrid } from "@/components/card-grid";
import { CardSelectionToolbar } from "@/components/card-selection-toolbar";
import { CardTile } from "@/components/card-tile";
import {
  clearSavedScrollPosition,
  restoreScrollPosition,
  scrollMainToTop,
} from "@/components/mobile-scroll-shell";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { SearchBar } from "@/components/search-bar";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import {
  applyChecklistCountOverrides,
  CHECKLIST_COUNT_CHANGED_EVENT,
  type ChecklistCountChangedDetail,
  writeChecklistCountOverride,
} from "@/lib/checklist-count-overrides.client";
import { isSearchableQuery } from "@/lib/search";
import { useCardGridSelection } from "@/lib/use-card-grid-selection";
import { useSearchPageState } from "@/lib/use-search-page-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

type SearchResult = CardDetail & {
  setName: string;
  owned: boolean;
  checklistCount?: number;
  rarity?: string | null;
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
  return applyChecklistCountOverrides(results.filter(isSearchResult));
}

function patchStoredResultsChecklistCount(
  results: unknown[],
  cardId: string,
  checklistCount: number,
): unknown[] {
  return results.map((item) =>
    isSearchResult(item) && item.id === cardId
      ? { ...item, checklistCount }
      : item,
  );
}

function patchStoredResultsChecklistCounts(
  results: unknown[],
  checklistCounts: Record<string, number>,
): unknown[] {
  return results.map((item) => {
    if (!isSearchResult(item)) {
      return item;
    }

    const nextCount = checklistCounts[item.id];
    if (nextCount == null) {
      return item;
    }

    writeChecklistCountOverride(item.id, nextCount);
    return { ...item, checklistCount: nextCount };
  });
}

export default function SearchPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("collectionId")?.trim() ?? "";
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
  const results = useMemo(
    () => parseStoredResults(storedResults),
    [storedResults],
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [previewCard, setPreviewCard] = useState<CardDetail | null>(null);
  const [previewRarity, setPreviewRarity] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkChecklistOpen, setBulkChecklistOpen] = useState(false);
  const selection = useCardGridSelection();
  const searchRequestIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const initialSearchHandledRef = useRef(false);
  const offsetRef = useRef(offset);
  const resultsRef = useRef(results);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const skipScrollRestoreRef = useRef(false);
  const storedResultsRef = useRef(storedResults);

  useEffect(() => {
    storedResultsRef.current = storedResults;
  }, [storedResults]);

  useEffect(() => {
    offsetRef.current = offset;
    resultsRef.current = results;
  }, [offset, results]);

  const syncChecklistCountsToStoredResults = useCallback(
    (counts: Record<string, number>) => {
      const current = storedResultsRef.current;
      let changed = false;
      const next = current.map((item) => {
        if (!isSearchResult(item)) {
          return item;
        }
        const count = counts[item.id];
        if (count == null || item.checklistCount === count) {
          return item;
        }
        changed = true;
        writeChecklistCountOverride(item.id, count);
        return { ...item, checklistCount: count };
      });
      if (changed) {
        setResultsState({ results: next, hasMore, offset });
      }
    },
    [hasMore, offset, setResultsState],
  );

  const refreshCachedChecklistCounts = useCallback(async () => {
    const parsed = parseStoredResults(storedResultsRef.current);
    if (parsed.length === 0) {
      return;
    }

    const ids = [...new Set(parsed.map((card) => card.id))];
    const params = new URLSearchParams({ ids: ids.join(",") });
    try {
      const response = await fetch(
        apiUrl(`/api/cards/checklist-counts?${params}`, locale),
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        counts?: Record<string, number>;
      };
      if (payload.counts) {
        syncChecklistCountsToStoredResults(payload.counts);
      }
    } catch {
      // ignore — cached counts / overrides still apply
    }
  }, [locale, syncChecklistCountsToStoredResults]);

  useEffect(() => {
    if (!hydrated || pathname !== "/search") {
      return;
    }
    void refreshCachedChecklistCounts();
  }, [hydrated, pathname, refreshCachedChecklistCounts]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    function onChecklistCountChanged(event: Event) {
      const { cardId, count } = (event as CustomEvent<ChecklistCountChangedDetail>)
        .detail;
      const hasCard = storedResultsRef.current.some(
        (item) => isSearchResult(item) && item.id === cardId,
      );
      if (!hasCard) {
        return;
      }
      setResultsState({
        results: patchStoredResultsChecklistCount(
          storedResultsRef.current,
          cardId,
          count,
        ),
        hasMore,
        offset,
      });
    }

    window.addEventListener(CHECKLIST_COUNT_CHANGED_EVENT, onChecklistCountChanged);
    return () => {
      window.removeEventListener(
        CHECKLIST_COUNT_CHANGED_EVENT,
        onChecklistCountChanged,
      );
    };
  }, [hydrated, hasMore, offset, setResultsState]);

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
        skipScrollRestoreRef.current = true;
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
        if (collectionId) {
          params.set("collectionId", collectionId);
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
    [collectionId, locale, setResultsState],
  );

  const resetSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    clearStoredState();
    setLoading(false);
    setLoadingMore(false);
    setPreviewCard(null);
    setPreviewRarity(null);
    setPreviewOpen(false);
    clearSavedScrollPosition("/search");
    scrollMainToTop();
  }, [clearStoredState]);

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
    if (skipScrollRestoreRef.current) {
      skipScrollRestoreRef.current = false;
      return;
    }
    restoreScrollPosition("/search");
  }, [loading, loadingMore, query, results.length]);

  return (
    <MobilePage>
      <MobilePageHeader
        title={t("search.title")}
        subtitle={
          collectionId
            ? t("search.subtitleCollection")
            : t("search.subtitle")
        }
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

      <CardGrid>
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
              setName: card.setName,
              officialCode: card.officialCode,
              owned: card.owned,
              checklistCount: card.checklistCount ?? 0,
              price: card.variants.find((variant) => variant.price != null)?.price,
            }}
            selected={selection.isSelected(card.id)}
            longPressPreset="select"
            longPressActive={!selection.isSelecting}
            onLongPress={() => {
              if (!selection.isSelecting) {
                selection.enterWith(card.id);
              }
            }}
            onClick={() => {
              if (selection.shouldIgnoreTap()) {
                return;
              }

              if (selection.isSelecting) {
                selection.toggle(card.id);
                return;
              }

              setPreviewCard({
                id: card.id,
                number: card.number,
                name: card.name,
                imageUrl: card.imageUrl,
                setId: card.setId,
                setName: card.setName,
                officialCode: card.officialCode,
                variants: card.variants,
              });
              setPreviewRarity(card.rarity ?? null);
              setPreviewOpen(true);
            }}
          />
        ))}
      </CardGrid>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="py-4 text-center text-sm text-zinc-500"
        >
          {loadingMore ? t("collection.loadingMore") : null}
        </div>
      ) : null}

      <SetCardPreviewModal
        card={previewCard}
        rarity={previewRarity}
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewCard(null);
          setPreviewRarity(null);
        }}
        onChecklistChanged={(cardId, checklistCount) => {
          writeChecklistCountOverride(cardId, checklistCount);
          setResultsState({
            results: patchStoredResultsChecklistCount(
              storedResultsRef.current,
              cardId,
              checklistCount,
            ),
            hasMore,
            offset,
          });
        }}
      />

      <CardSelectionToolbar
        selectedCount={selection.selectedCount}
        onCancel={selection.clear}
        onAddToChecklist={() => setBulkChecklistOpen(true)}
      />

      <BulkAddToChecklistSheet
        cardIds={Array.from(selection.selectedIds)}
        open={bulkChecklistOpen}
        onClose={() => setBulkChecklistOpen(false)}
        onSaved={(checklistCounts) => {
          setResultsState({
            results: patchStoredResultsChecklistCounts(
              storedResultsRef.current,
              checklistCounts,
            ),
            hasMore,
            offset,
          });
          selection.clear();
          setBulkChecklistOpen(false);
        }}
      />
    </MobilePage>
  );
}
