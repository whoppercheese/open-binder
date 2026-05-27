"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Ellipsis, Layers, Loader2, Search, Trash2 } from "lucide-react";
import { ActionSheet } from "@/components/action-sheet";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CollectionEntriesView } from "@/components/collection-entries-view";
import { CollectionCover } from "@/components/collection-cover";
import { CollectionCoverPickerSheet } from "@/components/collection-cover-picker-sheet";
import { CardGrid } from "@/components/card-grid";
import { CardTile } from "@/components/card-tile";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProgressBar } from "@/components/progress-bar";
import { ViewTabs } from "@/components/view-tabs";
import {
  QuickAddToast,
  type QuickAddToastData,
} from "@/components/quick-add-toast";
import { addToCollection, pickDefaultVariantId } from "@/lib/collection-client";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { getRarityLabel, sortCanonicalRarities } from "@/lib/rarity";
import { useDefaultCondition } from "@/lib/use-default-condition";
import { cn, resolveSetDisplayCode } from "@/lib/utils";

type OwnershipFilter = "owned" | "missing";
type ViewMode = "grid" | "entries";

const collectionLinkClassName =
  "flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20";

function CollectionNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Search;
  label: string;
}) {
  return (
    <Link href={href} className={collectionLinkClassName}>
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-emerald-200/80"
        aria-hidden
      />
    </Link>
  );
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

type CollectionDetailHeaderProps = {
  collection: CollectionDetailResponse["collection"];
  set: CollectionDetailResponse["set"];
  progress: CollectionDetailResponse["progress"];
  isCustom: boolean;
  canChangeCover: boolean;
  onOpenMenu: () => void;
  onOpenCoverPicker: () => void;
};

function CollectionDetailHeader({
  collection,
  set,
  progress,
  isCustom,
  canChangeCover,
  onOpenMenu,
  onOpenCoverPicker,
}: CollectionDetailHeaderProps) {
  const t = useTranslations();

  const cover = (
    <CollectionCover
      name={collection.name}
      imageUrl={collection.imageUrl}
      coverImageUrl={collection.coverImageUrl}
      setId={collection.setId}
      setOfficialCode={set?.officialCode}
      className="h-14 w-14 shrink-0 text-base"
    />
  );

  return (
    <header className="shrink-0 space-y-3">
      <div className="flex items-start gap-3">
        {canChangeCover ? (
          <button
            type="button"
            onClick={onOpenCoverPicker}
            aria-label={t("collections.changeCover")}
            className="shrink-0 rounded-xl transition hover:opacity-90 active:scale-[0.98]"
          >
            {cover}
          </button>
        ) : (
          cover
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white">{collection.name}</h1>
          {set ? (
            <p className="text-sm text-zinc-500">
              {t("collections.createdFromSetPrefix")}
              <Link
                href={`/sets/${set.id}`}
                className="text-emerald-400 hover:text-emerald-300"
              >
                {resolveSetDisplayCode({
                  officialCode: set.officialCode,
                  setId: set.id,
                }) ?? set.name}
              </Link>
            </p>
          ) : isCustom ? (
            <p className="text-sm text-zinc-500">{t("collections.customLabel")}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t("collections.detailActions")}
          aria-haspopup="menu"
          onClick={onOpenMenu}
          className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 active:bg-white/10"
        >
          <Ellipsis className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {progress.totalCards > 0 ? (
        <div>
          <div className="mb-1 flex justify-between text-sm text-zinc-400">
            <span>{t("collections.detailProgress")}</span>
            <span>
              {progress.ownedCards}/{progress.totalCards}
            </span>
          </div>
          <ProgressBar value={progress.percent} />
        </div>
      ) : null}
    </header>
  );
}

type CollectionOverviewTabProps = {
  collectionId: string;
  data: CollectionDetailResponse;
  ownershipFilter: OwnershipFilter | null;
  rarityFilter: string | null;
  rarities: string[];
  filteredCards: CollectionDetailResponse["cards"];
  hasActiveFilters: boolean;
  onOwnershipFilterChange: (filter: OwnershipFilter | null) => void;
  onRarityFilterChange: (filter: string | null) => void;
  onOpenCard: (card: CollectionDetailResponse["cards"][number]) => void;
  onQuickAdd: (card: CollectionDetailResponse["cards"][number]) => void;
};

function CollectionOverviewTab({
  collectionId,
  data,
  ownershipFilter,
  rarityFilter,
  rarities,
  filteredCards,
  hasActiveFilters,
  onOwnershipFilterChange,
  onRarityFilterChange,
  onOpenCard,
  onQuickAdd,
}: CollectionOverviewTabProps) {
  const t = useTranslations();
  const isEmpty = data.cards.length === 0;
  const searchHref = `/search?collectionId=${encodeURIComponent(collectionId)}`;

  return (
    <div className="space-y-5">
      {isEmpty ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            {t("collections.emptyCustom")}
          </div>
          <div className="space-y-2">
            <CollectionNavLink
              href={searchHref}
              icon={Search}
              label={t("collections.goToSearch")}
            />
            <CollectionNavLink
              href="/sets"
              icon={Layers}
              label={t("collections.goToSets")}
            />
          </div>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={ownershipFilter === "owned"}
                onClick={() =>
                  onOwnershipFilterChange(
                    ownershipFilter === "owned" ? null : "owned",
                  )
                }
              >
                {t("sets.filterOwned")}
              </FilterChip>
              <FilterChip
                active={ownershipFilter === "missing"}
                onClick={() =>
                  onOwnershipFilterChange(
                    ownershipFilter === "missing" ? null : "missing",
                  )
                }
              >
                {t("sets.filterMissing")}
              </FilterChip>
            </div>

            {rarities.length > 0 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {rarities.map((rarity) => (
                  <FilterChip
                    key={rarity}
                    active={rarityFilter === rarity}
                    onClick={() =>
                      onRarityFilterChange(
                        rarityFilter === rarity ? null : rarity,
                      )
                    }
                  >
                    {getRarityLabel(rarity, t) ?? rarity}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            {hasActiveFilters ? (
              <p className="text-xs text-zinc-500">
                {t.plural("sets.filteredCardsSummary", data.cards.length, {
                  filtered: filteredCards.length,
                  total: data.cards.length,
                })}
              </p>
            ) : null}
          </section>

          {filteredCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              {t("sets.emptyFilteredCards")}
            </div>
          ) : (
            <CardGrid>
              {filteredCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={{
                    id: card.id,
                    number: card.number,
                    name: card.name,
                    setId: card.setId,
                    imageUrl: card.imageUrl,
                    owned: card.owned,
                    ownedQuantity: card.ownedQuantity,
                    flagged: card.flagged,
                    officialCode: card.officialCode,
                    price: card.variants.find((variant) => variant.price != null)
                      ?.price,
                  }}
                  compact
                  onClick={() => void onOpenCard(card)}
                  onLongPress={() => void onQuickAdd(card)}
                />
              ))}
            </CardGrid>
          )}
        </>
      )}
    </div>
  );
}

type CollectionDetailResponse = {
  collection: {
    id: string;
    name: string;
    imageUrl: string | null;
    coverCardId: string | null;
    coverImageUrl: string | null;
    type: "set" | "custom";
    setId: string | null;
    setName: string | null;
  };
  cards: Array<{
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    imageUrl: string | null;
    setId: string;
    officialCode: string | null;
    owned: boolean;
    ownedQuantity: number;
    flagged: boolean;
    variants: Array<{
      id: string;
      variantType: string;
      ownedQuantity: number;
      price: number | null;
      cardmarketProductId: number | null;
    }>;
  }>;
  progress: {
    ownedCards: number;
    totalCards: number;
    percent: number;
  };
  set: {
    id: string;
    name: string;
    officialCode: string | null;
  } | null;
};

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = useTranslations();
  const [data, setData] = useState<CollectionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter | null>(
    null,
  );
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [quickAddToast, setQuickAddToast] = useState<QuickAddToastData | null>(
    null,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const addingCardIdsRef = useRef(new Set<string>());
  const quickAddTimeoutRef = useRef<number | null>(null);
  const { defaultCondition } = useDefaultCondition();
  const collectionId = params.id;

  const highlightCardId = searchParams.get("cardId")?.trim() ?? "";
  const viewParam = searchParams.get("view");
  const initialViewMode: ViewMode =
    viewParam === "entries"
      ? "entries"
      : viewParam === "grid"
        ? "grid"
        : highlightCardId
          ? "entries"
          : "grid";
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const handleCoverSaved = useCallback(
    (update: {
      coverCardId: string | null;
      coverImageUrl: string | null;
      updatedAt: string;
    }) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              collection: {
                ...prev.collection,
                coverCardId: update.coverCardId,
                coverImageUrl: update.coverImageUrl,
                updatedAt: update.updatedAt,
              },
            }
          : prev,
      );
    },
    [],
  );

  const setViewModeWithUrl = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "entries") {
        params.set("view", "entries");
      } else {
        params.delete("view");
        // Card filter applies to the inventory tab only; keep URL in sync when
        // leaving it so "view in collection" links can switch tabs again.
        params.delete("cardId");
      }
      const query = params.toString();
      router.replace(
        query ? `/collections/${collectionId}?${query}` : `/collections/${collectionId}`,
        { scroll: false },
      );
    },
    [collectionId, router, searchParams],
  );

  const clearCardFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cardId");
    const query = params.toString();
    router.replace(
      query ? `/collections/${collectionId}?${query}` : `/collections/${collectionId}`,
      { scroll: false },
    );
  }, [collectionId, router, searchParams]);

  const rarities = useMemo(() => {
    if (!data?.cards) return [];
    const unique = new Set<string>();
    for (const card of data.cards) {
      if (card.rarity) unique.add(card.rarity);
    }
    return sortCanonicalRarities(Array.from(unique));
  }, [data]);

  const filteredCards = useMemo(() => {
    if (!data?.cards) return [];
    return data.cards.filter((card) => {
      if (ownershipFilter === "owned" && !card.owned) return false;
      if (ownershipFilter === "missing" && card.owned) return false;
      if (rarityFilter && card.rarity !== rarityFilter) return false;
      return true;
    });
  }, [data, ownershipFilter, rarityFilter]);

  const hasActiveFilters = ownershipFilter != null || rarityFilter != null;

  const showQuickAddToast = useCallback(
    (toast: QuickAddToastData, duration = 2500) => {
      setQuickAddToast(toast);
      if (quickAddTimeoutRef.current != null) {
        window.clearTimeout(quickAddTimeoutRef.current);
      }
      quickAddTimeoutRef.current = window.setTimeout(() => {
        setQuickAddToast(null);
        quickAddTimeoutRef.current = null;
      }, duration);
    },
    [],
  );

  const handleQuickAdd = useCallback(
    async (card: CollectionDetailResponse["cards"][number]) => {
      if (addingCardIdsRef.current.has(card.id)) return;

      const variantId = pickDefaultVariantId(card.variants);
      if (!variantId) return;

      addingCardIdsRef.current.add(card.id);
      try {
        await addToCollection({
          collectionId,
          variantId,
          condition: defaultCondition,
        });
        bumpRefresh();
        showQuickAddToast({
          kind: "success",
          number: card.number,
          name: card.name,
          condition: defaultCondition,
        });
      } catch {
        showQuickAddToast(
          { kind: "error", message: t("errors.addFailed") },
          3000,
        );
      } finally {
        addingCardIdsRef.current.delete(card.id);
      }
    },
    [bumpRefresh, collectionId, defaultCondition, showQuickAddToast, t],
  );

  const load = useCallback(async () => {
    const response = await fetch(
      apiUrl(`/api/collections/${collectionId}/cards`, locale),
    );
    const payload = await response.json();
    if (!response.ok || !payload.collection) {
      setData(null);
      setLoading(false);
      return;
    }
    setData(payload as CollectionDetailResponse);
    setLoading(false);
  }, [collectionId, locale]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    return () => {
      if (quickAddTimeoutRef.current != null) {
        window.clearTimeout(quickAddTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "entries") {
      setViewMode("entries");
      return;
    }
    if (viewParam === "grid") {
      setViewMode("grid");
      return;
    }
    setViewMode(initialViewMode);
  }, [initialViewMode, searchParams]);

  async function handleDeleteCollection() {
    setDeleting(true);
    try {
      const response = await fetch(
        apiUrl(`/api/collections/${collectionId}`, locale),
        { method: "DELETE" },
      );
      if (response.ok) {
        router.push("/collections");
      }
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  async function openCardModal(card: CollectionDetailResponse["cards"][number]) {
    const response = await fetch(
      apiUrl(
        `/api/cards/${card.id}?collectionId=${encodeURIComponent(collectionId)}`,
        locale,
      ),
    );
    const payload = await response.json();
    if (response.ok) {
      setSelectedCard(payload as CardDetail);
      setOpen(true);
      return;
    }
    setSelectedCard({
      id: card.id,
      number: card.number,
      name: card.name,
      imageUrl: card.imageUrl,
      setId: card.setId,
      setName: data?.set?.name ?? data?.collection.setName ?? undefined,
      officialCode: card.officialCode,
      variants: card.variants,
    });
    setOpen(true);
  }

  const collectionActionItems = useMemo(
    () => [
      {
        id: "delete",
        label: t("collections.delete"),
        icon: <Trash2 className="h-4 w-4 shrink-0" />,
        destructive: true,
        onSelect: () => setConfirmDeleteOpen(true),
      },
    ],
    [t],
  );

  if (loading) {
    return (
      <div className="px-4 pt-6 text-sm text-zinc-400">
        {t("collections.detailLoading")}
      </div>
    );
  }

  if (!data?.collection) {
    return (
      <div className="px-4 pt-6 text-sm text-zinc-500">
        {t("collections.detailNotFound")}
      </div>
    );
  }

  const isCustom = data.collection.type === "custom";
  const canChangeCover = isCustom
    ? data.cards.length > 0
    : data.set != null;

  return (
    <div className="flex min-h-0 flex-col space-y-5 px-4 pt-6">
      <div className="shrink-0 space-y-5">
        <CollectionDetailHeader
          collection={data.collection}
          set={data.set}
          progress={data.progress}
          isCustom={isCustom}
          canChangeCover={canChangeCover}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenCoverPicker={() => setCoverPickerOpen(true)}
        />

        <ViewTabs
          aria-label={t("collections.detailTabsLabel")}
          tabs={[
            { id: "grid" as const, label: t("collections.detailTabOverview") },
            { id: "entries" as const, label: t("collections.detailTabInventory") },
          ]}
          value={viewMode}
          onChange={setViewModeWithUrl}
        />
      </div>

      <div className="min-h-0 flex-1" role="tabpanel">
        {viewMode === "entries" ? (
          <CollectionEntriesView
            collectionId={collectionId}
            cardId={highlightCardId}
            refreshKey={refreshKey}
            onCardFilterClear={clearCardFilter}
            onEntriesMutated={bumpRefresh}
          />
        ) : (
          <CollectionOverviewTab
            collectionId={collectionId}
            data={data}
            ownershipFilter={ownershipFilter}
            rarityFilter={rarityFilter}
            rarities={rarities}
            filteredCards={filteredCards}
            hasActiveFilters={hasActiveFilters}
            onOwnershipFilterChange={setOwnershipFilter}
            onRarityFilterChange={setRarityFilter}
            onOpenCard={openCardModal}
            onQuickAdd={handleQuickAdd}
          />
        )}
      </div>

      <CardModal
        key={selectedCard?.id ?? "closed"}
        card={selectedCard}
        collectionId={collectionId}
        collectionName={data.collection.name}
        collectionType={data.collection.type}
        open={open}
        onClose={() => {
          setOpen(false);
          setSelectedCard(null);
        }}
        onSaved={bumpRefresh}
        onRemovedFromChecklist={bumpRefresh}
      />

      {quickAddToast ? <QuickAddToast data={quickAddToast} /> : null}

      <ActionSheet
        open={menuOpen}
        title={t("collections.detailActions")}
        items={collectionActionItems}
        onClose={() => setMenuOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("collections.deleteTitle")}
        message={t("collections.deleteMessage", { name: data.collection.name })}
        loading={deleting}
        onConfirm={() => void handleDeleteCollection()}
        onCancel={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
      />

      {canChangeCover ? (
        <CollectionCoverPickerSheet
          open={coverPickerOpen}
          collectionId={collectionId}
          cards={data.cards}
          setLogo={
            data.set
              ? {
                  setId: data.set.id,
                  setOfficialCode: data.set.officialCode,
                  setName: data.set.name,
                }
              : null
          }
          selectedCardId={data.collection.coverCardId}
          onClose={() => setCoverPickerOpen(false)}
          onSaved={handleCoverSaved}
        />
      ) : null}
    </div>
  );
}
