"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { CardFlagBadge } from "@/components/card-flag-badge";
import { ConditionBadge } from "@/components/condition-badge";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import {
  CardModal,
  type CardDetail,
  type CollectionEntry,
} from "@/components/card-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SearchBar } from "@/components/search-bar";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { loadCardDetail, loadCollectionEntriesPage } from "@/lib/offline/read";
import { notifyCollectionMutated } from "@/lib/offline/types";
import {
  formatCardPriceLabel,
  formatCurrency,
  resolveSetDisplayCode,
} from "@/lib/utils";

const PAGE_SIZE = 20;

const VARIANT_KEYS: Record<string, string> = {
  normal: "common.variantNormal",
  holo: "common.variantHolo",
  reverse_holo: "common.variantReverseHolo",
  first_edition: "common.variantFirstEdition",
};

const LANGUAGE_KEYS: Record<string, string> = {
  de: "common.languageDe",
  en: "common.languageEn",
};

type CollectionItem = {
  id: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string | null;
  flagged: boolean;
  variantId: string;
  variantType: string;
  cardId: string;
  name: string;
  number: string;
  setId: string;
  setName: string;
  setOfficialCode: string | null;
  imageUrl: string | null;
  price: number | null;
  value: number | null;
};

type CollectionGroup = {
  setId: string;
  setName: string;
  setOfficialCode: string | null;
  items: CollectionItem[];
};

type FilterCard = {
  cardId: string;
  name: string;
  number: string;
  setId: string;
  setName: string;
};

function groupBySet(items: CollectionItem[]): CollectionGroup[] {
  const groups = new Map<string, CollectionGroup>();

  for (const item of items) {
    const existing = groups.get(item.setId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.setId, {
        setId: item.setId,
        setName: item.setName,
        setOfficialCode: item.setOfficialCode,
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

type CollectionEntriesViewProps = {
  collectionId: string;
  cardId?: string;
  refreshKey?: number;
  readOnly?: boolean;
  onCardFilterClear?: () => void;
  onEntriesMutated?: () => void;
};

export function CollectionEntriesView({
  collectionId,
  cardId = "",
  refreshKey = 0,
  readOnly = false,
  onCardFilterClear,
  onEntriesMutated,
}: CollectionEntriesViewProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [filterCard, setFilterCard] = useState<FilterCard | null>(null);
  const [total, setTotal] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CollectionItem | null>(
    null,
  );
  const [expandedImage, setExpandedImage] = useState<{
    cardId: string;
    setId: string;
    number: string;
    name: string;
  } | null>(null);
  const [editEntry, setEditEntry] = useState<CollectionEntry | null>(null);
  const [editCard, setEditCard] = useState<CardDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  function variantLabel(type: string) {
    const key = VARIANT_KEYS[type];
    return key ? t(key) : type;
  }

  const loadPage = useCallback(
    async (reset: boolean, searchQuery: string, filterCardId: string) => {
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
        if (filterCardId) {
          setFilterCard(null);
        }
      } else {
        setLoadingMore(true);
      }

      const trimmed = searchQuery.trim();

      try {
        const result = await loadCollectionEntriesPage(collectionId, locale, {
          offset: reset ? 0 : offsetRef.current,
          limit: PAGE_SIZE,
          query: trimmed,
          cardId: filterCardId,
        });

        if (!result.ok) {
          if (reset) {
            setItems([]);
            setTotal(0);
            setTotalValue(0);
            setFilterCard(null);
          }
          setHasMore(false);
          return;
        }

        const payload = result.data;
        const newItems = payload.items;

        if (reset) {
          setItems(newItems);
          setTotal(payload.total);
          setTotalValue(payload.totalValue);
          setFilterCard(payload.filterCard);
        } else {
          setItems((current) => [...current, ...newItems]);
        }

        offsetRef.current = reset
          ? newItems.length
          : offsetRef.current + newItems.length;
        setHasMore(payload.hasMore);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionId, locale],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage(true, query, cardId);
    }, query.trim() ? 300 : 0);

    return () => clearTimeout(timer);
  }, [query, cardId, loadPage, refreshKey]);

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
          void loadPage(false, query, cardId);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, query, cardId, loadPage, items.length]);

  const groups = useMemo(() => groupBySet(items), [items]);
  const filterLabel = filterCard
    ? `${filterCard.name} · ${filterCard.setName} · ${filterCard.number}`
    : null;

  async function removeItem(item: CollectionItem) {
    const removedValue = item.value;
    setUpdatingId(item.id);
    try {
      await fetch(`/api/collection/${item.id}`, { method: "DELETE" });
      notifyCollectionMutated(collectionId);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (removedValue != null) {
        setTotalValue((value) => value - removedValue);
      }
      setTotal((current) => Math.max(0, current - 1));
      onEntriesMutated?.();
    } finally {
      setUpdatingId((current) => (current === item.id ? null : current));
    }
  }

  async function adjustQuantity(item: CollectionItem, delta: number) {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      setDeleteCandidate(item);
      return;
    }

    setUpdatingId(item.id);
    try {
      const response = await fetch(`/api/collection/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      if (!response.ok) {
        return;
      }

      notifyCollectionMutated(collectionId);

      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                quantity: newQuantity,
                value:
                  entry.price != null ? entry.price * newQuantity : null,
              }
            : entry,
        ),
      );

      const unitPrice = item.price;
      if (unitPrice != null) {
        setTotalValue((value) => value + unitPrice * delta);
      }
      onEntriesMutated?.();
    } finally {
      setUpdatingId((current) => (current === item.id ? null : current));
    }
  }

  function requestDelete(item: CollectionItem) {
    setDeleteCandidate(item);
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    const item =
      items.find((entry) => entry.id === deleteCandidate.id) ?? deleteCandidate;
    await removeItem(item);
    setDeleteCandidate(null);
  }

  function clearCardFilter() {
    if (onCardFilterClear) {
      onCardFilterClear();
      return;
    }
    router.replace(`/collections/${collectionId}`);
  }

  function resetSearch() {
    setQuery("");
    if (cardId) {
      clearCardFilter();
    }
  }

  const hasActiveSearch = query.trim().length > 0 || Boolean(cardId);

  async function openEdit(item: CollectionItem) {
    if (editLoadingId != null) return;

    setEditLoadingId(item.id);
    try {
      const result = await loadCardDetail(
        item.cardId,
        collectionId,
        locale,
        {
          id: item.cardId,
          number: item.number,
          name: item.name,
          imageUrl: item.imageUrl,
          setId: item.setId,
          setName: item.setName,
          officialCode: item.setOfficialCode,
          variants: [
            {
              id: item.variantId,
              variantType: item.variantType,
              ownedQuantity: item.quantity,
              price: item.price,
            },
          ],
        },
      );
      if (!result.ok) {
        throw new Error("CARD_LOAD_FAILED");
      }

      setEditCard(result.data);
      setEditEntry({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        condition: item.condition,
        language: item.language,
        notes: item.notes,
        flagged: item.flagged,
      });
      setEditOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setEditLoadingId(null);
    }
  }

  function closeEdit() {
    setEditOpen(false);
    setEditEntry(null);
    setEditCard(null);
  }

  const emptyMessage = cardId
    ? t("collection.emptyForCard")
    : query.trim()
      ? t("collection.emptyForSearch")
      : t("collections.emptyEntries");

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        {t("collection.entriesSummary", {
          entriesPart: t.plural("common.entryCount", total),
          value: formatCurrency(totalValue, "EUR", locale),
        })}
      </p>

      {cardId ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-emerald-300/80">
              {t("collection.filteredByCard")}
            </p>
            <p className="truncate font-medium">
              {filterLabel ?? t("collection.loadingCard")}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCardFilter}
            className="shrink-0 rounded-lg p-2 text-emerald-200 hover:bg-emerald-500/10"
            aria-label={t("collection.clearCardFilter")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <SearchBar
        value={query}
        onChange={setQuery}
        onClear={resetSearch}
        showClear={hasActiveSearch}
        placeholder={t("collection.searchPlaceholder")}
      />

      {loading ? (
        <p className="text-sm text-zinc-400">{t("collection.loading")}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {emptyMessage}
        </div>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => {
          const setCode = resolveSetDisplayCode({
            officialCode: group.setOfficialCode,
            setId: group.setId,
          });
          return (
          <section key={group.setId} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              {group.setName}
              {setCode ? (
                <span className="font-normal text-zinc-500"> · {setCode}</span>
              ) : null}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => (
                <article
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedImage({
                        cardId: item.cardId,
                        setId: item.setId,
                        number: item.number,
                        name: item.name,
                      })
                    }
                    className="relative aspect-card w-16 shrink-0 cursor-pointer transition hover:opacity-90 active:scale-[0.98]"
                    aria-label={t("collection.expandImage")}
                  >
                    <CardFrame className="size-full">
                      <CardImage
                        cardId={item.cardId}
                        setId={item.setId}
                        number={item.number}
                        alt={item.name}
                        className="h-full w-full"
                      />
                    </CardFrame>
                  </button>
                  {readOnly ? (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="flex min-w-0 items-center gap-1.5 font-medium text-white">
                        {item.flagged ? <CardFlagBadge size="sm" /> : null}
                        <span className="truncate">{item.name}</span>
                      </p>
                      <p className="text-xs text-zinc-500">{item.number}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                        <span>{variantLabel(item.variantType)}</span>
                        <ConditionBadge condition={item.condition} />
                        <span>
                          {t(LANGUAGE_KEYS[item.language] ?? "common.unknown")}
                        </span>
                      </p>
                      {item.notes ? (
                        <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>
                      ) : null}
                      <p
                        className={`mt-1 text-sm font-semibold ${item.value != null ? "text-emerald-400" : "text-zinc-500"}`}
                      >
                        {item.value != null
                          ? formatCurrency(item.value, "EUR", locale)
                          : formatCardPriceLabel(
                              null,
                              t("collection.valueLabel"),
                              locale,
                            )}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={editLoadingId === item.id}
                      onClick={() => void openEdit(item)}
                      className="min-w-0 flex-1 cursor-pointer text-left transition hover:opacity-90 disabled:opacity-60"
                    >
                      <p className="flex min-w-0 items-center gap-1.5 font-medium text-white">
                        {item.flagged ? <CardFlagBadge size="sm" /> : null}
                        <span className="truncate">{item.name}</span>
                      </p>
                      <p className="text-xs text-zinc-500">{item.number}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                        <span>{variantLabel(item.variantType)}</span>
                        <ConditionBadge condition={item.condition} />
                        <span>
                          {t(LANGUAGE_KEYS[item.language] ?? "common.unknown")}
                        </span>
                      </p>
                      {item.notes ? (
                        <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>
                      ) : null}
                      <p
                        className={`mt-1 text-sm font-semibold ${item.value != null ? "text-emerald-400" : "text-zinc-500"}`}
                      >
                        {item.value != null
                          ? formatCurrency(item.value, "EUR", locale)
                          : formatCardPriceLabel(
                              null,
                              t("collection.valueLabel"),
                              locale,
                            )}
                      </p>
                    </button>
                  )}
                  {readOnly ? (
                    <div className="flex shrink-0 items-center self-stretch">
                      <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-white">
                        ×{item.quantity}
                      </span>
                    </div>
                  ) : (
                  <div
                    className="flex shrink-0 flex-col items-end justify-between self-stretch"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/20 p-0.5">
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => void adjustQuantity(item, -1)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        aria-label={t("collection.decreaseQuantity")}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={updatingId === item.id || item.quantity >= 999}
                        onClick={() => void adjustQuantity(item, 1)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        aria-label={t("collection.increaseQuantity")}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() => requestDelete(item)}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-red-400 disabled:opacity-40"
                      aria-label={t("collection.deleteEntry")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  )}
                </article>
              ))}
            </div>
          </section>
          );
        })}
      </div>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="py-4 text-center text-sm text-zinc-500"
        >
          {loadingMore ? t("collection.loadingMore") : null}
        </div>
      ) : null}

      <CardImageLightbox
        open={expandedImage != null}
        cardId={expandedImage?.cardId ?? ""}
        setId={expandedImage?.setId}
        number={expandedImage?.number}
        alt={expandedImage?.name ?? ""}
        onClose={() => setExpandedImage(null)}
      />

      <CardModal
        key={editEntry?.id ?? "closed"}
        card={editCard}
        collectionId={collectionId}
        entry={editEntry}
        open={editOpen}
        readOnly={readOnly}
        onClose={closeEdit}
        onSaved={() => {
          void loadPage(true, query, cardId);
          onEntriesMutated?.();
        }}
      />

      <ConfirmDialog
        open={deleteCandidate != null}
        title={t("collection.deleteTitle")}
        message={
          deleteCandidate
            ? t("collection.deleteMessage", { name: deleteCandidate.name })
            : ""
        }
        loading={deleteCandidate != null && updatingId === deleteCandidate.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
