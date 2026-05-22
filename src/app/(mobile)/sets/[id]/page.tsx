"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { ProgressBar } from "@/components/progress-bar";
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
    ownedVariants: number;
    totalVariants: number;
    percent: number;
  };
};

export default function SetDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<SetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter | null>(
    null,
  );
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);

  const rarities = useMemo(() => {
    if (!data?.cards) return [];
    const unique = new Set<string>();
    for (const card of data.cards) {
      if (card.rarity) unique.add(card.rarity);
    }
    return sortRarities(Array.from(unique));
  }, [data?.cards]);

  const filteredCards = useMemo(() => {
    if (!data?.cards) return [];
    return data.cards.filter((card) => {
      if (ownershipFilter === "owned" && !card.owned) return false;
      if (ownershipFilter === "missing" && card.owned) return false;
      if (rarityFilter && card.rarity !== rarityFilter) return false;
      return true;
    });
  }, [data?.cards, ownershipFilter, rarityFilter]);

  const hasActiveFilters = ownershipFilter != null || rarityFilter != null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch(`/api/sets/${params.id}`);
      const payload = await response.json();
      if (!cancelled) {
        setData(payload);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id, refreshKey]);

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
              {data.progress.ownedVariants}/{data.progress.totalVariants}
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
    </div>
  );
}
