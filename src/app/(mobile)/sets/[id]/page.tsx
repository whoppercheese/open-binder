"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { ProgressBar } from "@/components/progress-bar";

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

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {data.cards.map((card) => (
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
                setName: data.set.nameDe,
                officialCode: data.set.officialCode,
                variants: card.variants,
              });
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
        onSaved={() => setRefreshKey((value) => value + 1)}
      />
    </div>
  );
}
