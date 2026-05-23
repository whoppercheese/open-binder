"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { ProgressBar } from "@/components/progress-bar";
import { addToCollection, pickDefaultVariantId } from "@/lib/collection-client";
import { cn } from "@/lib/utils";

const RARITY_ORDER = [
  "Häufig",
  "Ungewöhnlich",
  "Selten",
  "Doppel-Selten",
  "Ultra Selten",
  "Illustrations-Selten",
  "Geheimes Selten",
  "Promo",
];

type OwnershipFilter = "owned" | "missing";

function sortRarities(rarities: string[]) {
  return [...rarities].sort((a, b) => {
    const indexA = RARITY_ORDER.indexOf(a);
    const indexB = RARITY_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, "de");
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
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

type SetDetailResponse = {
  set: {
    id: string;
    nameDe: string;
    officialCode: string | null;
    cardsSyncedAt: string | null;
  };
  cards: Array<{
    id: string;
    number: string;
    nameDe: string;
    rarity: string | null;
    imageUrl: string | null;
    owned: boolean;
    ownedQuantity: number;
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
};

export default function SetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const [quickAddMessage, setQuickAddMessage] = useState<string | null>(null);
  const addingCardIdsRef = useRef(new Set<string>());
  const quickAddTimeoutRef = useRef<number | null>(null);

  const cardsSynced = data?.set.cardsSyncedAt != null;

  const rarities = useMemo(() => {
    if (!data?.cards) return [];
    const unique = new Set<string>();
    for (const card of data.cards) {
      if (card.rarity) unique.add(card.rarity);
    }
    return sortRarities(Array.from(unique));
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

  const showQuickAddMessage = useCallback((message: string, duration = 2500) => {
    setQuickAddMessage(message);
    if (quickAddTimeoutRef.current != null) {
      window.clearTimeout(quickAddTimeoutRef.current);
    }
    quickAddTimeoutRef.current = window.setTimeout(() => {
      setQuickAddMessage(null);
      quickAddTimeoutRef.current = null;
    }, duration);
  }, []);

  const handleQuickAdd = useCallback(
    async (card: SetDetailResponse["cards"][number]) => {
      if (addingCardIdsRef.current.has(card.id)) return;

      const variantId = pickDefaultVariantId(card.variants);
      if (!variantId) return;

      addingCardIdsRef.current.add(card.id);
      try {
        await addToCollection({ variantId });
        setRefreshKey((value) => value + 1);
        showQuickAddMessage(`${card.number} · ${card.nameDe} hinzugefügt`);
      } catch (error) {
        showQuickAddMessage(
          error instanceof Error ? error.message : "Hinzufügen fehlgeschlagen",
          3000,
        );
      } finally {
        addingCardIdsRef.current.delete(card.id);
      }
    },
    [showQuickAddMessage],
  );

  useEffect(() => {
    return () => {
      if (quickAddTimeoutRef.current != null) {
        window.clearTimeout(quickAddTimeoutRef.current);
      }
    };
  }, []);

  const loadSet = useCallback(async () => {
    const response = await fetch(`/api/sets/${params.id}`);
    const payload = await response.json();
    setData(payload);
    setLoading(false);
    return payload as SetDetailResponse;
  }, [params.id]);

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

    if (status.cardsSyncedAt && !data?.set.cardsSyncedAt) {
      await loadSet();
      router.refresh();
      return;
    }

    const activeJob = status.activeJob;
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
  }, [data?.set.cardsSyncedAt, loadSet, params.id, router]);

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
    if (cardsSynced) {
      return;
    }

    let cancelled = false;

    (async () => {
      await loadSyncStatus();
      if (cancelled) return;
    })();

    const timer = setInterval(() => {
      void loadSyncStatus();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cardsSynced, loadSyncStatus]);

  async function handleLoadCards() {
    setLoadError(null);
    setLoadingCards(true);

    const response = await fetch("/api/sync/set-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: params.id }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setLoadError(
        (body.error as string) ?? "Karten-Sync konnte nicht gestartet werden.",
      );
    } else {
      await loadSyncStatus();
    }

    setLoadingCards(false);
  }

  if (loading) {
    return (
      <div className="px-4 pt-6 text-sm text-zinc-400">Set wird geladen…</div>
    );
  }

  if (!data?.set) {
    return (
      <div className="px-4 pt-6 text-sm text-red-400">Set nicht gefunden.</div>
    );
  }

  if (!cardsSynced) {
    return (
      <div className="space-y-5 px-4 pt-6">
        <header>
          <h1 className="text-2xl font-bold">
            {data.set.nameDe}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {data.set.officialCode ?? data.set.id}
            </span>
          </h1>
        </header>

        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          {syncStatus === "pending" || syncStatus === "running" ? (
            <div className="flex flex-col items-center gap-3 text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
              <p>{syncMessage ?? "Karten werden geladen…"}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500">
                Für dieses Set wurden noch keine Kartendaten geladen.
              </p>
              {loadError ? (
                <p className="mt-3 text-sm text-amber-400">{loadError}</p>
              ) : null}
              <button
                type="button"
                onClick={handleLoadCards}
                disabled={loadingCards}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {loadingCards ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Karten laden
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">
            {data.set.nameDe}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {data.set.officialCode ?? data.set.id}
            </span>
          </h1>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm text-zinc-400">
            <span>Fortschritt</span>
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
            Im Besitz
          </FilterChip>
          <FilterChip
            active={ownershipFilter === "missing"}
            onClick={() =>
              setOwnershipFilter((current) =>
                current === "missing" ? null : "missing",
              )
            }
          >
            Nicht im Besitz
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
                {rarity}
              </FilterChip>
            ))}
          </div>
        ) : null}

        {hasActiveFilters ? (
          <p className="text-xs text-zinc-500">
            {filteredCards.length} von {data.cards.length} Karten
          </p>
        ) : null}
      </section>

      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Keine Karten für diese Filter.
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {filteredCards.map((card) => (
          <CardTile
            key={card.id}
            card={{
              id: card.id,
              number: card.number,
              nameDe: card.nameDe,
              setId: data.set.id,
              imageUrl: card.imageUrl,
              owned: card.owned,
              ownedQuantity: card.ownedQuantity,
              price: card.variants.find((variant) => variant.price != null)?.price,
            }}
            compact
            onClick={() => {
              setSelectedCard({
                id: card.id,
                number: card.number,
                nameDe: card.nameDe,
                imageUrl: card.imageUrl,
                setId: data.set.id,
                setName: data.set.nameDe,
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

      {quickAddMessage ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2.5 text-center text-sm text-emerald-100 shadow-lg backdrop-blur-sm">
          {quickAddMessage}
        </div>
      ) : null}
    </div>
  );
}
