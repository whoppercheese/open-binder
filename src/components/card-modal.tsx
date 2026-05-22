"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { CardImage } from "@/components/card-image";
import {
  CONDITION_LABELS,
  LANGUAGE_LABELS,
  VARIANT_LABELS,
  cn,
  formatCurrency,
} from "@/lib/utils";

export type CardVariantOption = {
  id: string;
  variantType: string;
  ownedQuantity?: number | null;
  price?: number | null;
};

export type CardDetail = {
  id: string;
  number: string;
  nameDe: string;
  imageUrl?: string | null;
  setName?: string;
  officialCode?: string | null;
  variants: CardVariantOption[];
};

type CardModalProps = {
  card: CardDetail | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function CardModal({ card, open, onClose, onSaved }: CardModalProps) {
  const defaultVariant = useMemo(() => {
    if (!card) return null;
    return (
      card.variants.find((variant) => (variant.ownedQuantity ?? 0) > 0) ??
      card.variants[0] ??
      null
    );
  }, [card]);

  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("nm");
  const [language, setLanguage] = useState("de");
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeVariantId = variantId || defaultVariant?.id || "";
  const selectedVariant = card?.variants.find(
    (variant) => variant.id === activeVariantId,
  );

  if (!open || !card) return null;

  async function handleSave() {
    if (!activeVariantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: activeVariantId,
          quantity,
          condition,
          language,
          notes: notes || null,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Speichern fehlgeschlagen");
      }
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 pb-24 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151922] p-4 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {card.officialCode ?? card.setName} · #{card.number}
            </p>
            <h2 className="text-lg font-semibold text-white">{card.nameDe}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-4">
          <div className="relative h-36 w-24 shrink-0">
            <CardImage
              cardId={card.id}
              alt={card.nameDe}
              owned
              className="h-full w-full"
            />
          </div>
          <div className="flex-1 space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-zinc-400">Variante</span>
              <select
                value={activeVariantId}
                onChange={(event) => setVariantId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              >
                {card.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {VARIANT_LABELS[variant.variantType] ?? variant.variantType}
                    {variant.price != null
                      ? ` · ${formatCurrency(variant.price)}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-zinc-400">Anzahl</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-400">Zustand</span>
                <select
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                >
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-zinc-400">Sprache</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              >
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-zinc-400">Notiz</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-zinc-400">Kaufpreis (EUR)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
          </div>
        </div>

        {selectedVariant?.price != null ? (
          <p className="mb-3 text-sm text-emerald-400">
            Cardmarket: {formatCurrency(selectedVariant.price)}
          </p>
        ) : null}

        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          disabled={loading || !activeVariantId}
          onClick={handleSave}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-black transition",
            (loading || !activeVariantId) && "opacity-60",
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Zur Sammlung hinzufügen
        </button>
      </div>
    </div>
  );
}
