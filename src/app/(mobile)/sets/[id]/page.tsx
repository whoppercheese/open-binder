"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Download, Ellipsis, RefreshCw, Trash2 } from "lucide-react";
import { ActionSheet } from "@/components/action-sheet";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProgressBar } from "@/components/progress-bar";
import {
  QuickAddToast,
  type QuickAddToastData,
} from "@/components/quick-add-toast";
import { addToCollection, pickDefaultVariantId } from "@/lib/collection-client";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { formatSyncJobMessage } from "@/lib/sync-job-display";
import { getRarityLabel, sortCanonicalRarities } from "@/lib/rarity";
import { useDefaultCondition } from "@/lib/use-default-condition";
import { cn } from "@/lib/utils";

type OwnershipFilter = "owned" | "missing";

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

type SetDetailResponse = {
  set: {
    id: string;
    name: string;
    officialCode: string | null;
    cardsSyncedAt: string | null;
    cardCountTotal?: number;
    cardCountOfficial?: number;
  };
  cards: Array<{
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    imageUrl: string | null;
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
  collectionEntryCount: number;
};

export default function SetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const [data, setData] = useState<SetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter | null>(
    null,
  );
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "pending" | "running">(
    "idle",
  );
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quickAddToast, setQuickAddToast] = useState<QuickAddToastData | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingCards, setDeletingCards] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const addingCardIdsRef = useRef(new Set<string>());
  const quickAddTimeoutRef = useRef<number | null>(null);
  const hadActiveSyncJobRef = useRef(false);
  const { defaultCondition } = useDefaultCondition();

  const cardsSynced = data?.set?.cardsSyncedAt != null;
  const syncActive =
    syncStatus === "pending" || syncStatus === "running" || loadingCards;

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
    async (card: SetDetailResponse["cards"][number]) => {
      if (addingCardIdsRef.current.has(card.id)) return;

      const variantId = pickDefaultVariantId(card.variants);
      if (!variantId) return;

      addingCardIdsRef.current.add(card.id);
      try {
        await addToCollection({ variantId, condition: defaultCondition });
        setRefreshKey((value) => value + 1);
        showQuickAddToast({
          kind: "success",
          number: card.number,
          name: card.name,
          condition: defaultCondition,
        });
      } catch (error) {
        showQuickAddToast(
          {
            kind: "error",
            message:
              error instanceof Error
                ? error.message === "COLLECTION_ADD_FAILED"
                  ? t("errors.addFailed")
                  : error.message
                : t("errors.addFailed"),
          },
          3000,
        );
      } finally {
        addingCardIdsRef.current.delete(card.id);
      }
    },
    [showQuickAddToast, defaultCondition],
  );

  useEffect(() => {
    return () => {
      if (quickAddTimeoutRef.current != null) {
        window.clearTimeout(quickAddTimeoutRef.current);
      }
    };
  }, []);

  const loadSet = useCallback(async () => {
    const response = await fetch(apiUrl(`/api/sets/${params.id}`, locale));
    const payload = await response.json();
    if (!response.ok || !payload.set) {
      setData(null);
      setLoading(false);
      return null;
    }
    setData(payload as SetDetailResponse);
    setLoading(false);
    return payload as SetDetailResponse;
  }, [params.id, locale]);

  const loadSyncStatus = useCallback(async () => {
    const response = await fetch(
      `/api/sync/set-cards?setIds=${encodeURIComponent(params.id)}`,
    );
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      sets: Array<{
        setId: string;
        cardsSyncedAt: string | null;
        activeJob: {
          status: string;
          message: string | null;
        } | null;
      }>;
    };

    const status = payload.sets[0];
    if (!status) {
      return;
    }

    const activeJob = status.activeJob;
    const hasActiveJob =
      activeJob?.status === "running" || activeJob?.status === "pending";

    if (status.cardsSyncedAt && !data?.set?.cardsSyncedAt) {
      await loadSet();
      router.refresh();
      hadActiveSyncJobRef.current = false;
      setSyncStatus("idle");
      setSyncMessage(null);
      return;
    }

    if (hadActiveSyncJobRef.current && !hasActiveJob && data?.set?.cardsSyncedAt) {
      await loadSet();
      router.refresh();
    }

    hadActiveSyncJobRef.current = hasActiveJob;

    if (activeJob?.status === "running") {
      setSyncStatus("running");
      setSyncMessage(activeJob.message);
    } else if (activeJob?.status === "pending") {
      setSyncStatus("pending");
      setSyncMessage(activeJob.message);
    } else {
      setSyncStatus("idle");
      setSyncMessage(null);
    }
  }, [data?.set?.cardsSyncedAt, loadSet, params.id, router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadSet();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSet, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadSyncStatus();
      if (cancelled) return;
    })();

    const shouldPoll =
      !cardsSynced || syncStatus === "pending" || syncStatus === "running";

    if (!shouldPoll) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => {
      void loadSyncStatus();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cardsSynced, syncStatus, loadSyncStatus]);

  const handleLoadCards = useCallback(async () => {
    setLoadError(null);
    setLoadingCards(true);

    const response = await fetch("/api/sync/set-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: params.id }),
    });

    if (!response.ok) {
      setLoadError(t("errors.cardSyncStartFailed"));
    } else {
      setSyncStatus("pending");
      setSyncMessage(t("sync.syncPreparing"));
      await loadSet();
      await loadSyncStatus();
    }

    setLoadingCards(false);
  }, [loadSet, loadSyncStatus, params.id, t]);

  async function handleDeleteCardData() {
    setDeleteError(null);
    setDeletingCards(true);

    try {
      const response = await fetch(`/api/sets/${params.id}/cards`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setDeleteError(t("errors.cardDataDeleteFailed"));
        setConfirmDeleteOpen(false);
        return;
      }

      setConfirmDeleteOpen(false);
      setMenuOpen(false);
      setSelectedCard(null);
      setOpen(false);
      await loadSet();
      router.refresh();
    } finally {
      setDeletingCards(false);
    }
  }

  const deleteConfirmMessage = useMemo(() => {
    const entryCount = data?.collectionEntryCount ?? 0;
    const parts = [t("sets.deleteConfirmIntro")];

    if (entryCount > 0) {
      parts.push(t.plural("sets.deleteConfirmWithEntries", entryCount));
    } else {
      parts.push(t("sets.deleteConfirmNoEntries"));
    }

    parts.push(t("sets.deleteConfirmResyncNote"));
    return parts;
  }, [data?.collectionEntryCount, t]);

  const actionSheetItems = useMemo(
    () => [
      {
        id: "resync",
        label: syncActive
          ? t("sets.resyncRunning")
          : t("sets.resyncCards"),
        icon: syncActive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 shrink-0" />
        ),
        disabled: syncActive,
        onSelect: () => void handleLoadCards(),
      },
      {
        id: "delete-cards",
        label: t("sets.deleteCardData"),
        icon: <Trash2 className="h-4 w-4 shrink-0" />,
        destructive: true,
        disabled: syncActive,
        onSelect: () => setConfirmDeleteOpen(true),
      },
    ],
    [handleLoadCards, syncActive, t],
  );

  if (loading) {
    return (
      <div className="px-4 pt-6 text-sm text-zinc-400">
        {t("sets.detailLoading")}
      </div>
    );
  }

  const cardCountHint =
    data?.set?.cardCountOfficial || data?.set?.cardCountTotal || null;

  const loadCardsPanel = (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
      {syncStatus === "pending" || syncStatus === "running" ? (
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <p>
            {formatSyncJobMessage(syncMessage, t) ??
              t("sets.detailCardsLoading")}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {t("sets.detailNoCardData")}
          </p>
          {cardCountHint ? (
            <p className="mt-2 text-xs text-zinc-600">
              {t.plural("sets.detailCardCountHint", cardCountHint)}
            </p>
          ) : null}
          {loadError ? (
            <p className="mt-3 text-sm text-red-400">{loadError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleLoadCards()}
            disabled={loadingCards}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {loadingCards ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("sets.loadCards")}
          </button>
        </>
      )}
    </div>
  );

  if (!data?.set) {
    return (
      <div className="space-y-5 px-4 pt-6">
        <header>
          <h1 className="text-2xl font-bold">{params.id}</h1>
        </header>
        {loadCardsPanel}
      </div>
    );
  }

  if (!cardsSynced) {
    return (
      <div className="space-y-5 px-4 pt-6">
        <header>
          <h1 className="text-2xl font-bold">
            {data.set.name}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {data.set.officialCode ?? data.set.id}
            </span>
          </h1>
        </header>

        {loadCardsPanel}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold">
            {data.set.name}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {data.set.officialCode ?? data.set.id}
            </span>
          </h1>
          <button
            type="button"
            aria-label={t("sets.setActions")}
            aria-haspopup="menu"
            onClick={() => setMenuOpen(true)}
            className="-mr-1 mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 active:bg-white/10"
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {deleteError ? (
          <p className="text-sm text-red-400">{deleteError}</p>
        ) : null}
        {loadError ? (
          <p className="text-sm text-red-400">{loadError}</p>
        ) : null}
        {syncStatus === "pending" || syncStatus === "running" ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
            <span>
              {formatSyncJobMessage(syncMessage, t) ??
                t("sets.detailCardsUpdating")}
            </span>
          </div>
        ) : null}
        <div>
          <div className="mb-1 flex justify-between text-sm text-zinc-400">
            <span>{t("sets.detailProgress")}</span>
            <span>
              {data.progress.ownedCards}/{data.progress.totalCards}
            </span>
          </div>
          <ProgressBar value={data.progress.percent} />
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={ownershipFilter === "owned"}
            onClick={() =>
              setOwnershipFilter((current) =>
                current === "owned" ? null : "owned",
              )
            }
          >
            {t("sets.filterOwned")}
          </FilterChip>
          <FilterChip
            active={ownershipFilter === "missing"}
            onClick={() =>
              setOwnershipFilter((current) =>
                current === "missing" ? null : "missing",
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
                  setRarityFilter((current) =>
                    current === rarity ? null : rarity,
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
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {filteredCards.map((card) => (
          <CardTile
            key={card.id}
            card={{
              id: card.id,
              number: card.number,
              name: card.name,
              setId: data.set.id,
              imageUrl: card.imageUrl,
              owned: card.owned,
              ownedQuantity: card.ownedQuantity,
              flagged: card.flagged,
              price: card.variants.find((variant) => variant.price != null)?.price,
            }}
            compact
            onClick={() => {
              setSelectedCard({
                id: card.id,
                number: card.number,
                name: card.name,
                imageUrl: card.imageUrl,
                setId: data.set.id,
                setName: data.set.name,
                officialCode: data.set.officialCode,
                variants: card.variants,
              });
              setOpen(true);
            }}
            onLongPress={() => void handleQuickAdd(card)}
          />
        ))}
      </div>
      )}

      <CardModal
        key={selectedCard?.id ?? "closed"}
        card={selectedCard}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />

      {quickAddToast ? <QuickAddToast data={quickAddToast} /> : null}

      <ActionSheet
        open={menuOpen}
        title={t("sets.setActions")}
        items={actionSheetItems}
        onClose={() => setMenuOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("sets.deleteCardDataTitle")}
        message={deleteConfirmMessage}
        loading={deletingCards}
        onConfirm={() => void handleDeleteCardData()}
        onCancel={() => {
          if (!deletingCards) {
            setConfirmDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
