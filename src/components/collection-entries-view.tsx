"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
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
import { ConditionBadgeButton } from "@/components/condition-badge";
import { SearchBar } from "@/components/search-bar";
import { ActiveFilterBanner } from "@/components/ui/active-filter-banner";
import { FilterChipList } from "@/components/ui/filter-chip";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import {
  collectAvailableConditions,
  filterCollectionEntries,
  loadAllCollectionEntries,
  loadCardDetail,
} from "@/lib/offline/read";
import { notifyCollectionMutated } from "@/lib/offline/types";
import {
  resolveSetDisplayCode,
  type CardCondition,
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
  illustrator: string | null;
  imageUrl: string | null;
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

  const [allItems, setAllItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState<CardCondition | null>(
    null,
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  function variantLabel(type: string) {
    const key = VARIANT_KEYS[type];
    return key ? t(key) : type;
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadAllCollectionEntries(collectionId, locale);
      if (result.ok) {
        setAllItems(result.data.items);
      } else {
        setAllItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [collectionId, locale]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, refreshKey]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, cardId, conditionFilter, collectionId]);

  const availableConditions = useMemo(
    () => collectAvailableConditions(allItems, cardId),
    [allItems, cardId],
  );

  const filteredItems = useMemo(
    () =>
      filterCollectionEntries(allItems, {
        query,
        cardId,
        condition:
          conditionFilter && availableConditions.includes(conditionFilter)
            ? conditionFilter
            : null,
      }),
    [allItems, availableConditions, cardId, conditionFilter, query],
  );

  const total = filteredItems.length;

  const items = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const hasMore = visibleCount < filteredItems.length;

  const filterCard = useMemo((): FilterCard | null => {
    if (!cardId) {
      return null;
    }
    const match = allItems.find((item) => item.cardId === cardId);
    if (!match) {
      return null;
    }
    return {
      cardId: match.cardId,
      name: match.name,
      number: match.number,
      setId: match.setId,
      setName: match.setName,
    };
  }, [allItems, cardId]);

  useEffect(() => {
    if (!hasMore || loading) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + PAGE_SIZE, filteredItems.length),
          );
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredItems.length, hasMore, loading]);

  const groups = useMemo(() => groupBySet(items), [items]);
  const filterLabel = filterCard
    ? `${filterCard.name} · ${filterCard.setName} · ${filterCard.number}`
    : null;

  async function removeItem(item: CollectionItem) {
    setUpdatingId(item.id);
    try {
      await fetch(`/api/collection/${item.id}`, { method: "DELETE" });
      notifyCollectionMutated(collectionId);
      setAllItems((current) => current.filter((entry) => entry.id !== item.id));
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

      setAllItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: newQuantity }
            : entry,
        ),
      );

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
    : query.trim() && conditionFilter
      ? t("collection.emptyForSearchAndCondition")
      : query.trim()
        ? t("collection.emptyForSearch")
        : conditionFilter
          ? t("collection.emptyForCondition")
          : t("collections.emptyEntries");

  return (
    <div className="space-y-4">
      {cardId ? (
        <ActiveFilterBanner
          label={t("collection.filteredByCard")}
          value={filterLabel ?? t("collection.loadingCard")}
          onClear={clearCardFilter}
          clearLabel={t("collection.clearCardFilter")}
        />
      ) : null}

      <SearchBar
        value={query}
        onChange={setQuery}
        onClear={resetSearch}
        showClear={hasActiveSearch}
        placeholder={t("collection.searchPlaceholder")}
      />

      {availableConditions.length > 1 ? (
        <FilterChipList scroll>
          {availableConditions.map((condition) => (
            <ConditionBadgeButton
              key={condition}
              condition={condition}
              size="sm"
              selected={conditionFilter === condition}
              onClick={() =>
                setConditionFilter((current) =>
                  current === condition ? null : condition,
                )
              }
            />
          ))}
        </FilterChipList>
      ) : null}

      {!loading ? (
        <p className="text-sm text-zinc-400">
          {t.plural("common.entryCount", total)}
        </p>
      ) : null}

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
        <div ref={sentinelRef} className="py-4" aria-hidden="true" />
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
