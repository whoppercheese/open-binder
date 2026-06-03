"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Download, RefreshCw, Trash2 } from "lucide-react";
import { ActionSheet } from "@/components/action-sheet";
import { BulkAddToChecklistSheet } from "@/components/bulk-add-to-checklist-sheet";
import { CardGrid } from "@/components/card-grid";
import { CardSelectionToolbar } from "@/components/card-selection-toolbar";
import { CardTile } from "@/components/card-tile";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateCollectionSheet } from "@/components/create-collection-sheet";
import {
  SetCardPreviewModal,
} from "@/components/set-card-preview-modal";
import type { CardDetail } from "@/components/card-modal";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { formatSyncJobMessage } from "@/lib/sync-job-display";
import { getRarityLabel, sortCanonicalRarities } from "@/lib/rarity";
import { useCardGridSelection } from "@/lib/use-card-grid-selection";
import { Button } from "@/components/ui/button";
import { FilterChip, FilterChipList } from "@/components/ui/filter-chip";
import { FullWidthRow } from "@/components/ui/full-width-row";
import { TextLink } from "@/components/ui/text-link";
import { IconMenuButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { MobilePage } from "@/components/mobile-page";
import { cn } from "@/lib/utils";

type OwnershipFilter = "owned" | "missing";

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
    checklistCount: number;
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
  setCollectionCount: number;
};

export default function SetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const [data, setData] = useState<SetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingCards, setDeletingCards] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<CardDetail | null>(null);
  const [previewRarity, setPreviewRarity] = useState<string | null>(null);
  const [previewOwnedQuantity, setPreviewOwnedQuantity] = useState<
    number | undefined
  >();
  const [previewChecklistCount, setPreviewChecklistCount] = useState<
    number | undefined
  >();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkChecklistOpen, setBulkChecklistOpen] = useState(false);
  const selection = useCardGridSelection();
  const hadActiveSyncJobRef = useRef(false);

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
          <Loader2 className="h-5 w-5 animate-spin text-accent-hover" />
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
          <Button
            variant="soft"
            className="mt-4"
            loading={loadingCards}
            icon={
              !loadingCards ? <Download className="h-4 w-4" /> : undefined
            }
            onClick={() => void handleLoadCards()}
          >
            {t("sets.loadCards")}
          </Button>
        </>
      )}
    </div>
  );

  const setTitle = data?.set ? (
    <>
      {data.set.name}
      <span className="ml-2 text-base font-normal text-zinc-500">
        {data.set.officialCode ?? data.set.id}
      </span>
    </>
  ) : (
    params.id
  );

  if (!data?.set) {
    return (
      <MobilePage>
        <PageHeader title={setTitle} />
        {loadCardsPanel}
      </MobilePage>
    );
  }

  if (!cardsSynced) {
    return (
      <MobilePage>
        <PageHeader title={setTitle} />
        {loadCardsPanel}
      </MobilePage>
    );
  }

  return (
    <MobilePage>
      <PageHeader
        title={setTitle}
        subtitle={
          <>
            <p>{t("collections.setCatalogHint")}</p>
            {data.setCollectionCount > 0 ? (
              <TextLink
                href={`/collections?setId=${encodeURIComponent(params.id)}`}
                className="text-xs text-accent-text/85 hover:text-accent-text-soft"
              >
                {t.plural("collections.setBindersCount", data.setCollectionCount, {
                  count: data.setCollectionCount,
                })}
              </TextLink>
            ) : null}
          </>
        }
        trailing={
          <IconMenuButton
            aria-label={t("sets.setActions")}
            onClick={() => setMenuOpen(true)}
          />
        }
      >
        {deleteError ? (
          <p className="text-sm text-red-400">{deleteError}</p>
        ) : null}
        {loadError ? (
          <p className="text-sm text-red-400">{loadError}</p>
        ) : null}
        {syncStatus === "pending" || syncStatus === "running" ? (
          <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-accent-text-soft">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-hover" />
            <span>
              {formatSyncJobMessage(syncMessage, t) ??
                t("sets.detailCardsUpdating")}
            </span>
          </div>
        ) : null}
      </PageHeader>

      <section className="space-y-2">
        <FullWidthRow
          variant="emeraldAction"
          showChevron={false}
          onClick={() => setCreateOpen(true)}
        >
          {t("collections.createFromSet")}
        </FullWidthRow>
      </section>

      <section className="space-y-3">
        <FilterChipList>
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
        </FilterChipList>

        {rarities.length > 0 ? (
          <FilterChipList>
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
          </FilterChipList>
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
              setId: data.set.id,
              imageUrl: card.imageUrl,
              owned: card.owned,
              ownedQuantity: card.ownedQuantity,
              flagged: card.flagged,
              officialCode: data.set.officialCode,
              checklistCount: card.checklistCount,
            }}
            compact
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
                setId: data.set.id,
                setName: data.set.name,
                officialCode: data.set.officialCode,
                variants: card.variants,
              });
              setPreviewRarity(card.rarity);
              setPreviewOwnedQuantity(
                card.ownedQuantity > 0 ? card.ownedQuantity : undefined,
              );
              setPreviewChecklistCount(
                card.checklistCount > 0 ? card.checklistCount : undefined,
              );
              setPreviewOpen(true);
            }}
          />
        ))}
      </CardGrid>
      )}

      <SetCardPreviewModal
        card={previewCard}
        rarity={previewRarity}
        ownedQuantity={previewOwnedQuantity}
        checklistCount={previewChecklistCount}
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewCard(null);
          setPreviewRarity(null);
          setPreviewOwnedQuantity(undefined);
          setPreviewChecklistCount(undefined);
        }}
        onChecklistChanged={(cardId, checklistCount) => {
          setData((current) => {
            if (!current) return current;
            return {
              ...current,
              cards: current.cards.map((card) =>
                card.id === cardId ? { ...card, checklistCount } : card,
              ),
            };
          });
        }}
      />

      <CreateCollectionSheet
        open={createOpen}
        setId={data.set.id}
        defaultName={data.set.name}
        onClose={() => {
          setCreateOpen(false);
        }}
      />

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
          setData((current) => {
            if (!current) return current;
            return {
              ...current,
              cards: current.cards.map((card) =>
                checklistCounts[card.id] != null
                  ? { ...card, checklistCount: checklistCounts[card.id]! }
                  : card,
              ),
            };
          });
          selection.clear();
          setBulkChecklistOpen(false);
        }}
      />
    </MobilePage>
  );
}
