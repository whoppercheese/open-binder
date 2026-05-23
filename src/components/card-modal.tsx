"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Minus, Plus, WalletCards, X } from "lucide-react";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import { Portal } from "@/components/portal";
import { getCardmarketProductUrl } from "@/lib/cardmarket";
import {
  cardmarketIsFoilForVariant,
  type VariantType,
} from "@/lib/tcgdex";
import {
  CONDITION_LABELS,
  LANGUAGE_LABELS,
  VARIANT_LABELS,
  cn,
  formatCardPriceLabel,
  formatCurrency,
  hasCardPrice,
} from "@/lib/utils";

export type CardVariantOption = {
  id: string;
  variantType: string;
  ownedQuantity?: number | null;
  price?: number | null;
  cardmarketProductId?: number | null;
};

export type CardDetail = {
  id: string;
  number: string;
  nameDe: string;
  imageUrl?: string | null;
  setId?: string;
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

function createInitialFormState(card: CardDetail | null) {
  if (!card) {
    return {
      variantId: "",
      quantity: 1,
      condition: "nm",
      language: "de",
      notes: "",
      purchasePrice: "",
    };
  }

  const defaultVariant =
    card.variants.find((variant) => (variant.ownedQuantity ?? 0) > 0) ??
    card.variants[0] ??
    null;

  return {
    variantId: defaultVariant?.id ?? "",
    quantity: 1,
    condition: "nm",
    language: "de",
    notes: "",
    purchasePrice: "",
  };
}

export function CardModal({ card, open, onClose, onSaved }: CardModalProps) {
  const defaultVariant = useMemo(() => {
    if (!card) return null;
    return (
      card.variants.find((variant) => (variant.ownedQuantity ?? 0) > 0) ??
      card.variants[0] ??
      null
    );
  }, [card]);

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("nm");
  const [language, setLanguage] = useState("de");
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);

  function handleClose() {
    setImageExpanded(false);
    onClose();
  }

  function resetForm(nextCard: CardDetail | null = card) {
    const initial = createInitialFormState(nextCard);
    setVariantId(initial.variantId);
    setQuantity(initial.quantity);
    setCondition(initial.condition);
    setLanguage(initial.language);
    setNotes(initial.notes);
    setPurchasePrice(initial.purchasePrice);
    setError(null);
  }

  const activeVariantId = variantId || defaultVariant?.id || "";
  const selectedVariant = card?.variants.find(
    (variant) => variant.id === activeVariantId,
  );
  const availableVariantTypes = useMemo(
    () => card?.variants.map((variant) => variant.variantType as VariantType) ?? [],
    [card?.variants],
  );
  const ownedCount = useMemo(
    () =>
      card?.variants.reduce(
        (sum, variant) => sum + (variant.ownedQuantity ?? 0),
        0,
      ) ?? 0,
    [card],
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
      resetForm();
      onSaved?.();
      handleClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Portal>
        <div
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center bg-black/70 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md cursor-auto rounded-3xl border border-white/10 bg-[#151922] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {card.setId ? (
                <Link
                  href={`/sets/${card.setId}`}
                  onClick={handleClose}
                  className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20 hover:text-emerald-300"
                >
                  {card.officialCode ?? card.setName}
                </Link>
              ) : (
                <span className="text-sm font-medium text-zinc-400">
                  {card.officialCode ?? card.setName}
                </span>
              )}
              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-sm font-medium tabular-nums text-zinc-200">
                #{card.number}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white">{card.nameDe}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-4">
          <button
            type="button"
            onClick={() => setImageExpanded(true)}
            className="relative aspect-card w-24 shrink-0 self-start cursor-pointer transition hover:opacity-90 active:scale-[0.98]"
            aria-label="Kartenbild vergrößern"
          >
            <CardFrame className="size-full">
              <CardImage
                cardId={card.id}
                setId={card.setId}
                number={card.number}
                alt={card.nameDe}
                className="h-full w-full"
              />
            </CardFrame>
          </button>
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
                    {` · ${formatCardPriceLabel(variant.price)}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="block space-y-1">
                <span className="text-zinc-400">Anzahl</span>
                <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                    aria-label="Anzahl verringern"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 flex-1 text-center text-sm font-semibold tabular-nums text-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= 999}
                    onClick={() => setQuantity((current) => Math.min(999, current + 1))}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                    aria-label="Anzahl erhöhen"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
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

        {selectedVariant ? (
          <p className="mb-3 text-sm">
            {selectedVariant.cardmarketProductId &&
            selectedVariant.price != null ? (
              <a
                href={getCardmarketProductUrl(selectedVariant.cardmarketProductId, {
                  foil: cardmarketIsFoilForVariant(
                    selectedVariant.variantType as VariantType,
                    availableVariantTypes,
                  ),
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-400 transition hover:text-emerald-300 hover:underline"
              >
                Cardmarket: {formatCurrency(selectedVariant.price)}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              </a>
            ) : (
              <span className="text-zinc-400 tabular-nums">
                Cardmarket-Preis{" "}
                {hasCardPrice(selectedVariant.price) ? (
                  <span className="font-medium text-emerald-400">
                    {formatCurrency(selectedVariant.price)}
                  </span>
                ) : (
                  <span className="font-semibold">—</span>
                )}
              </span>
            )}
          </p>
        ) : null}

        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

        {ownedCount > 0 ? (
          <Link
            href={`/collection?cardId=${encodeURIComponent(card.id)}`}
            onClick={handleClose}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
          >
            <WalletCards className="h-4 w-4" />
            In Sammlung anzeigen ({ownedCount})
          </Link>
        ) : null}

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
      </Portal>

      <CardImageLightbox
      open={imageExpanded}
      cardId={card.id}
      setId={card.setId}
      number={card.number}
      alt={card.nameDe}
      onClose={() => setImageExpanded(false)}
    />
  </>
  );
}
