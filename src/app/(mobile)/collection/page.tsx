"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { CardImage } from "@/components/card-image";
import {
  CONDITION_LABELS,
  LANGUAGE_LABELS,
  VARIANT_LABELS,
  formatCurrency,
} from "@/lib/utils";

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
  setName: string;
  imageUrl: string | null;
  price: number | null;
  value: number | null;
};

export default function CollectionPage() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch("/api/collection");
      const payload = await response.json();
      if (!cancelled) {
        setItems(payload.items ?? []);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function removeItem(id: string) {
    await fetch(`/api/collection/${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const totalValue = items.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="space-y-5 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Sammlung</h1>
        <p className="text-sm text-zinc-400">
          {items.length} Einträge · {formatCurrency(totalValue)}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-400">Sammlung wird geladen…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          Noch keine Karten gespeichert. Suche eine Karte oder öffne ein Set.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="relative h-24 w-16 shrink-0">
              <CardImage
                cardId={item.cardId}
                alt={item.nameDe}
                owned
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{item.nameDe}</p>
              <p className="text-xs text-zinc-500">
                {item.setName} · #{item.number}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {VARIANT_LABELS[item.variantType] ?? item.variantType} ·{" "}
                {CONDITION_LABELS[item.condition]} ·{" "}
                {LANGUAGE_LABELS[item.language]} · ×{item.quantity}
              </p>
              {item.notes ? (
                <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>
              ) : null}
              <p className="mt-1 text-sm font-semibold text-emerald-400">
                {item.value != null ? formatCurrency(item.value) : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="self-start rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
