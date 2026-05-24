"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  WalletCards,
  X,
} from "lucide-react";
import { CardFlagBadge } from "@/components/card-flag-badge";
import { ConditionBadgeButton } from "@/components/condition-badge";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import { Portal } from "@/components/portal";
import { getCardmarketProductUrl } from "@/lib/cardmarket";
import {
  addToCollection,
  pickDefaultVariantId,
  translateCollectionError,
  updateCollection,
} from "@/lib/collection-client";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { cardmarketIsFoilForVariant, type VariantType } from "@/lib/tcgdex";
import { useDefaultCondition } from "@/lib/use-default-condition";
import {
  CARD_CONDITIONS,
  cn,
  formatCardPriceLabel,
  formatCurrency,
  hasCardPrice,
  type CardCondition,
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
  name: string;
  imageUrl?: string | null;
  setId?: string;
  setName?: string;
  officialCode?: string | null;
  variants: CardVariantOption[];
};

export type CollectionEntry = {
  id: string;
  variantId: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string | null;
  purchasePrice: string | null;
  flagged: boolean;
};

type CardModalProps = {
  card: CardDetail | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  entry?: CollectionEntry | null;
};

const VARIANT_KEYS: Record<string, string> = {
  normal: "common.variantNormal",
  holo: "common.variantHolo",
  reverse_holo: "common.variantReverseHolo",
  first_edition: "common.variantFirstEdition",
};

const LANGUAGE_KEYS: Record<string, string> = {
  de: "common.languageDe",
  en: "common.languageEn",
};

function createInitialFormState(
  card: CardDetail | null,
  entry?: CollectionEntry | null,
  defaultCondition: CardCondition = "nm",
) {
  if (entry) {
    return {
      variantId: entry.variantId,
      quantity: entry.quantity,
      condition: entry.condition,
      language: entry.language,
      notes: entry.notes ?? "",
      purchasePrice: entry.purchasePrice ?? "",
      flagged: entry.flagged,
    };
  }

  if (!card) {
    return {
      variantId: "",
      quantity: 1,
      condition: defaultCondition,
      language: "de",
      notes: "",
      purchasePrice: "",
      flagged: false,
    };
  }

  return {
    variantId: pickDefaultVariantId(card.variants) ?? "",
    quantity: 1,
    condition: defaultCondition,
    language: "de",
    notes: "",
    purchasePrice: "",
    flagged: false,
  };
}

type CardModalFormProps = {
  card: CardDetail;
  onClose: () => void;
  onSaved?: () => void;
  entry?: CollectionEntry | null;
  defaultCondition: CardCondition;
};

function CardModalForm({
  card,
  onClose,
  onSaved,
  entry = null,
  defaultCondition,
}: CardModalFormProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const isEdit = entry != null;
  const initialForm = createInitialFormState(card, entry, defaultCondition);

  const defaultVariant = useMemo(() => {
    const variantId = pickDefaultVariantId(card.variants);
    return card.variants.find((variant) => variant.id === variantId) ?? null;
  }, [card]);

  const [variantId, setVariantId] = useState(initialForm.variantId);
  const [quantity, setQuantity] = useState(initialForm.quantity);
  const [condition, setCondition] = useState(initialForm.condition);
  const [language, setLanguage] = useState(initialForm.language);
  const [notes, setNotes] = useState(initialForm.notes);
  const [purchasePrice, setPurchasePrice] = useState(initialForm.purchasePrice);
  const [flagged, setFlagged] = useState(initialForm.flagged);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);

  function variantLabel(type: string) {
    const key = VARIANT_KEYS[type];
    return key ? t(key) : type;
  }

  function handleClose() {
    setImageExpanded(false);
    onClose();
  }

  function resetForm() {
    const initial = createInitialFormState(card, entry, defaultCondition);
    setVariantId(initial.variantId);
    setQuantity(initial.quantity);
    setCondition(initial.condition);
    setLanguage(initial.language);
    setNotes(initial.notes);
    setPurchasePrice(initial.purchasePrice);
    setFlagged(initial.flagged);
    setError(null);
  }

  const activeVariantId = variantId || defaultVariant?.id || "";
  const selectedVariant = card.variants.find(
    (variant) => variant.id === activeVariantId,
  );
  const availableVariantTypes = useMemo(
    () => card.variants.map((variant) => variant.variantType as VariantType),
    [card.variants],
  );
  const ownedCount = useMemo(
    () =>
      card.variants.reduce(
        (sum, variant) => sum + (variant.ownedQuantity ?? 0),
        0,
      ),
    [card],
  );
  const remoteImageUrl =
    card.imageUrl?.startsWith("https://assets.tcgdex.net")
      ? card.imageUrl
      : null;
  const needsSetDownload = card.variants.length === 0 && !isEdit;

  async function handleSave() {
    if (!activeVariantId) return;
    setLoading(true);
    setError(null);
    try {
      if (isEdit && entry) {
        await updateCollection(entry.id, {
          quantity,
          condition,
          language,
          notes: notes || null,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          flagged,
        });
      } else {
        await addToCollection({
          variantId: activeVariantId,
          quantity,
          condition,
          language,
          notes: notes || null,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          flagged,
        });
      }
      resetForm();
      onSaved?.();
      handleClose();
    } catch (saveError) {
      setError(
        translateCollectionError(
          saveError instanceof Error ? saveError.message : undefined,
          t,
        ),
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
                    {card.number}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {card.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className={cn(
                "mb-4",
                needsSetDownload
                  ? "flex flex-col items-center gap-4"
                  : "flex gap-4",
              )}
            >
              <button
                type="button"
                onClick={() => setImageExpanded(true)}
                className={cn(
                  "relative aspect-card shrink-0 cursor-pointer transition hover:opacity-90 active:scale-[0.98]",
                  needsSetDownload
                    ? "w-44 self-center sm:w-52"
                    : "w-24 self-start",
                )}
                aria-label={t("cardModal.expandImage")}
              >
                <CardFrame className="size-full">
                  <CardImage
                    cardId={card.id}
                    setId={card.setId}
                    number={card.number}
                    remoteImageUrl={remoteImageUrl}
                    alt={card.name}
                    className="h-full w-full"
                  />
                </CardFrame>
              </button>
              {!needsSetDownload ? (
              <div className="flex-1 space-y-3 text-sm">
                <label className="block space-y-1">
                  <span className="text-zinc-400">{t("cardModal.variant")}</span>
                  <select
                    value={activeVariantId}
                    onChange={(event) => setVariantId(event.target.value)}
                    disabled={isEdit}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white disabled:opacity-60"
                  >
                    {card.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variantLabel(variant.variantType)}
                        {` · ${formatCardPriceLabel(variant.price, t("common.price"), locale)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div className="block space-y-1">
                    <span className="text-zinc-400">{t("cardModal.quantity")}</span>
                    <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        disabled={quantity <= 1}
                        onClick={() =>
                          setQuantity((current) => Math.max(1, current - 1))
                        }
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        aria-label={t("cardModal.decreaseQuantity")}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 flex-1 text-center text-sm font-semibold tabular-nums text-white">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        disabled={quantity >= 999}
                        onClick={() =>
                          setQuantity((current) => Math.min(999, current + 1))
                        }
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        aria-label={t("cardModal.increaseQuantity")}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-zinc-400">{t("cardModal.language")}</span>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                    >
                      {Object.entries(LANGUAGE_KEYS).map(([value, key]) => (
                        <option key={value} value={value}>
                          {t(key)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="block space-y-2">
                  <span className="text-zinc-400">{t("cardModal.condition")}</span>
                  <div className="grid grid-cols-5 gap-2">
                    {CARD_CONDITIONS.map((value) => (
                      <ConditionBadgeButton
                        key={value}
                        condition={value}
                        selected={condition === value}
                        size="sm"
                        onClick={() => setCondition(value)}
                      />
                    ))}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-zinc-400">{t("cardModal.notes")}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-zinc-600"
              />
                </label>

                <label className="block space-y-1">
                  <span className="text-zinc-400">{t("cardModal.purchasePrice")}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={flagged}
                    onChange={(event) => setFlagged(event.target.checked)}
                    className="sr-only"
                  />
                  {flagged ? (
                    <CardFlagBadge size="sm" className="mt-0.5" />
                  ) : (
                    <span
                      className="mt-0.5 inline-flex size-5 shrink-0 rounded border border-white/20 bg-black/40"
                      aria-hidden
                    />
                  )}
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-white">
                      {t("cardModal.flag")}
                    </span>
                    <span className="block text-xs text-zinc-400">
                      {t("cardModal.flagHelp")}
                    </span>
                  </span>
                </label>
              </div>
              ) : null}
            </div>

            {needsSetDownload ? (
              <div className="mb-3 space-y-3">
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-center text-sm text-amber-200">
                  {t("cardModal.downloadSetHint")}
                </p>
                {card.setId ? (
                  <Link
                    href={`/sets/${card.setId}`}
                    onClick={handleClose}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    {t("cardModal.goToSet")}
                  </Link>
                ) : null}
              </div>
            ) : null}

            {!needsSetDownload && selectedVariant ? (
              <p className="mb-3 text-sm">
                {selectedVariant.cardmarketProductId &&
                selectedVariant.price != null ? (
                  <a
                    href={getCardmarketProductUrl(
                      selectedVariant.cardmarketProductId,
                      {
                        foil: cardmarketIsFoilForVariant(
                          selectedVariant.variantType as VariantType,
                          availableVariantTypes,
                        ),
                        locale,
                      },
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-400 transition hover:text-emerald-300 hover:underline"
                  >
                    {t("cardModal.cardmarketLink", {
                      price: formatCurrency(selectedVariant.price, "EUR", locale),
                    })}
                    <ExternalLink
                      className="h-3.5 w-3.5 shrink-0 opacity-80"
                      aria-hidden
                    />
                  </a>
                ) : (
                  <span className="text-zinc-400 tabular-nums">
                    {t("cardModal.cardmarketPrice")}{" "}
                    {hasCardPrice(selectedVariant.price) ? (
                      <span className="font-medium text-emerald-400">
                        {formatCurrency(selectedVariant.price, "EUR", locale)}
                      </span>
                    ) : (
                      <span className="font-semibold">
                        {t("common.priceUnavailable")}
                      </span>
                    )}
                  </span>
                )}
              </p>
            ) : null}

            {error ? (
              <p className="mb-3 text-sm text-red-400">{error}</p>
            ) : null}

            {ownedCount > 0 && !isEdit ? (
              <Link
                href={`/collection?cardId=${encodeURIComponent(card.id)}`}
                onClick={handleClose}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <WalletCards className="h-4 w-4" />
                {t("cardModal.viewInCollection", { count: ownedCount })}
              </Link>
            ) : null}

            {!needsSetDownload ? (
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
              {isEdit ? t("cardModal.save") : t("cardModal.addToCollection")}
            </button>
            ) : null}
          </div>
        </div>
      </Portal>

      <CardImageLightbox
        open={imageExpanded}
        cardId={card.id}
        setId={card.setId}
        number={card.number}
        remoteImageUrl={remoteImageUrl}
        alt={card.name}
        onClose={() => setImageExpanded(false)}
      />
    </>
  );
}

export function CardModal({
  card,
  open,
  onClose,
  onSaved,
  entry = null,
}: CardModalProps) {
  const { defaultCondition } = useDefaultCondition();

  if (!open || !card) return null;

  return (
    <CardModalForm
      key={`${card.id}-${entry?.id ?? "new"}-${defaultCondition}`}
      card={card}
      onClose={onClose}
      onSaved={onSaved}
      entry={entry}
      defaultCondition={defaultCondition}
    />
  );
}
