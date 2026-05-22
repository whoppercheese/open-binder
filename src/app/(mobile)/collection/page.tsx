"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SearchBar } from "@/components/search-bar";
import {
  CONDITION_LABELS,
  LANGUAGE_LABELS,
  VARIANT_LABELS,
  formatCardPriceLabel,
  formatCurrency,
} from "@/lib/utils";

const PAGE_SIZE = 20;

type CollectionItem = {
  id: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string | null;
  purchasePrice: string | null;
  variantType: string;
  cardId: string;
  nameDe: string;
  number: string;
  setId: string;
  setName: string;
  imageUrl: string | null;
  price: number | null;
  value: number | null;
};

type CollectionGroup = {
  setId: string;
  setName: string;
  items: CollectionItem[];
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
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

function CollectionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId")?.trim() ?? "";

  const [items, setItems] = useState<CollectionItem[]>([]);
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
    nameDe: string;
  } | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    async (reset: boolean, searchQuery: string, filterCardId: string) => {
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offsetRef.current),
      });
      const trimmed = searchQuery.trim();
      if (trimmed) {
        params.set("q", trimmed);
      }
      if (filterCardId) {
        params.set("cardId", filterCardId);
      }

      try {
        const response = await fetch(`/api/collection?${params}`);
        const payload = await response.json();
        const newItems: CollectionItem[] = payload.items ?? [];

        if (reset) {
          setItems(newItems);
          setTotal(payload.total ?? newItems.length);
          setTotalValue(payload.totalValue ?? 0);
        } else {
          setItems((current) => [...current, ...newItems]);
        }

        offsetRef.current += newItems.length;
        setHasMore(Boolean(payload.hasMore));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage(true, query, cardId);
    }, query.trim() ? 300 : 0);

    return () => clearTimeout(timer);
  }, [query, cardId, loadPage]);

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
  const filterLabel = items[0]
    ? `${items[0].nameDe} · ${items[0].setName} · #${items[0].number}`
    : null;

  async function removeItem(item: CollectionItem) {
    const removedValue = item.value;
    setUpdatingId(item.id);
    try {
      await fetch(`/api/collection/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (removedValue != null) {
        setTotalValue((value) => value - removedValue);
      }
      setTotal((current) => Math.max(0, current - 1));
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
    router.push("/collection");
  }

  const emptyMessage = cardId
    ? "Keine Einträge für diese Karte."
    : query.trim()
      ? "Keine Einträge für diese Suche."
      : "Noch keine Karten gespeichert. Suche eine Karte oder öffne ein Set.";

  return (
    <div className="space-y-5 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Sammlung</h1>
        <p className="text-sm text-zinc-400">
          {total} Einträge · {formatCurrency(totalValue)}
        </p>
      </header>

      {cardId ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-emerald-300/80">
              Gefiltert nach Karte
            </p>
            <p className="truncate font-medium">
              {filterLabel ?? "Karte wird geladen…"}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCardFilter}
            className="shrink-0 rounded-lg p-2 text-emerald-200 hover:bg-emerald-500/10"
            aria-label="Kartenfilter zurücksetzen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Name, Nummer oder Set"
      />

      {loading ? (
        <p className="text-sm text-zinc-400">Sammlung wird geladen…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {emptyMessage}
        </div>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.setId} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{group.setName}</h2>
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
                        nameDe: item.nameDe,
                      })
                    }
                    className="relative aspect-card w-16 shrink-0 cursor-pointer transition hover:opacity-90 active:scale-[0.98]"
                    aria-label="Kartenbild vergrößern"
                  >
                    <CardFrame className="size-full">
                      <CardImage
                        cardId={item.cardId}
                        setId={item.setId}
                        number={item.number}
                        alt={item.nameDe}
                        className="h-full w-full"
                      />
                    </CardFrame>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{item.nameDe}</p>
                    <p className="text-xs text-zinc-500">#{item.number}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {VARIANT_LABELS[item.variantType] ?? item.variantType} ·{" "}
                      {CONDITION_LABELS[item.condition]} ·{" "}
                      {LANGUAGE_LABELS[item.language]}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>
                    ) : null}
                    <p
                      className={`mt-1 text-sm font-semibold ${item.value != null ? "text-emerald-400" : "text-zinc-500"}`}
                    >
                      {item.value != null
                        ? formatCurrency(item.value)
                        : formatCardPriceLabel(null, "Wert")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
                    <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/20 p-0.5">
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => void adjustQuantity(item, -1)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        aria-label="Anzahl verringern"
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
                        aria-label="Anzahl erhöhen"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() => requestDelete(item)}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-red-400 disabled:opacity-40"
                      aria-label="Eintrag löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="py-4 text-center text-sm text-zinc-500"
        >
          {loadingMore ? "Weitere Einträge werden geladen…" : null}
        </div>
      ) : null}

      <CardImageLightbox
        open={expandedImage != null}
        cardId={expandedImage?.cardId ?? ""}
        setId={expandedImage?.setId}
        number={expandedImage?.number}
        alt={expandedImage?.nameDe ?? ""}
        onClose={() => setExpandedImage(null)}
      />

      <ConfirmDialog
        open={deleteCandidate != null}
        title="Eintrag löschen?"
        message={
          deleteCandidate
            ? `${deleteCandidate.nameDe} wirklich aus der Sammlung entfernen?`
            : ""
        }
        loading={deleteCandidate != null && updatingId === deleteCandidate.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-6 text-sm text-zinc-400">
          Sammlung wird geladen…
        </div>
      }
    >
      <CollectionPageContent />
    </Suspense>
  );
}
