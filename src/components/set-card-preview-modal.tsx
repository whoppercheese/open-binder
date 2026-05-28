"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListPlus } from "lucide-react";
import { AddToChecklistSheet } from "@/components/add-to-checklist-sheet";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { SheetCloseButton } from "@/components/ui/icon-button";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import { Portal } from "@/components/portal";
import type { CardDetail } from "@/components/card-modal";
import { writeChecklistCountOverride } from "@/lib/checklist-count-overrides.client";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { getRarityLabel } from "@/lib/rarity";
import {
  formatCardPriceLabel,
  resolveSetDisplayCode,
} from "@/lib/utils";

const VARIANT_KEYS: Record<string, string> = {
  normal: "common.variantNormal",
  holo: "common.variantHolo",
  reverse_holo: "common.variantReverseHolo",
  first_edition: "common.variantFirstEdition",
};

type SetCardPreviewModalProps = {
  card: CardDetail | null;
  rarity?: string | null;
  open: boolean;
  onClose: () => void;
  onChecklistChanged?: (cardId: string, checklistCount: number) => void;
};

export function SetCardPreviewModal({
  card,
  rarity = null,
  open,
  onClose,
  onChecklistChanged,
}: SetCardPreviewModalProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const [imageExpanded, setImageExpanded] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistCount, setChecklistCount] = useState<number | null>(null);

  const loadChecklistCount = useCallback(async () => {
    if (!card) return;
    try {
      const response = await fetch(
        apiUrl(`/api/cards/${card.id}/checklist`, locale),
      );
      const payload = await response.json();
      if (!response.ok) {
        setChecklistCount(null);
        return;
      }
      const collections: Array<{ onChecklist?: boolean }> =
        payload.collections ?? [];
      setChecklistCount(
        collections.filter((item) => item.onChecklist).length,
      );
    } catch {
      setChecklistCount(null);
    }
  }, [card, locale]);

  useEffect(() => {
    if (!open || !card) {
      setChecklistCount(null);
      return;
    }
    void loadChecklistCount();
  }, [open, card, loadChecklistCount]);

  const setLabel = card
    ? resolveSetDisplayCode({
        officialCode: card.officialCode,
        setId: card.setId,
      })
    : null;

  const rarityLabel = rarity ? getRarityLabel(rarity, t) ?? rarity : null;

  const variantLines = useMemo(() => {
    if (!card) return [];
    return card.variants.map((variant) => {
      const key = VARIANT_KEYS[variant.variantType];
      const label = key ? t(key) : variant.variantType;
      return {
        id: variant.id,
        label,
        price: formatCardPriceLabel(variant.price, t("common.price"), locale),
      };
    });
  }, [card, locale, t]);

  function handleClose() {
    setImageExpanded(false);
    setChecklistOpen(false);
    onClose();
  }

  function handleChecklistSaved(count: number) {
    if (card) {
      writeChecklistCountOverride(card.id, count);
      onChecklistChanged?.(card.id, count);
    }
    handleClose();
  }

  if (!open || !card) return null;

  const needsSetDownload = card.variants.length === 0;

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
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {setLabel ? (
                    <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400">
                      {setLabel}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-sm font-medium tabular-nums text-zinc-200">
                    {card.number}
                  </span>
                  {rarityLabel ? (
                    <span className="text-xs text-zinc-500">{rarityLabel}</span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold text-white">{card.name}</h2>
                {checklistCount !== null && checklistCount > 0 ? (
                  <TextLink
                    href={`/collections?cardId=${encodeURIComponent(card.id)}`}
                    onClick={handleClose}
                    className="mt-1 text-xs text-emerald-300/85 hover:text-emerald-200"
                  >
                    {t.plural("sets.checklistOnCount", checklistCount, {
                      count: checklistCount,
                    })}
                  </TextLink>
                ) : null}
              </div>
              <SheetCloseButton
                onClick={handleClose}
                aria-label={t("common.close")}
              />
            </div>

            {needsSetDownload ? (
              <div className="mb-4 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setImageExpanded(true)}
                  className="relative aspect-card w-28 cursor-pointer transition hover:opacity-90 active:scale-[0.98]"
                  aria-label={t("cardModal.expandImage")}
                >
                  <CardFrame className="size-full">
                    <CardImage
                      cardId={card.id}
                      setId={card.setId}
                      officialCode={card.officialCode}
                      number={card.number}
                      alt={card.name}
                      className="h-full w-full"
                    />
                  </CardFrame>
                </button>
                <p className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-center text-sm text-amber-200">
                  {t("cardModal.downloadSetHint")}
                </p>
              </div>
            ) : (
              <div className="mb-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setImageExpanded(true)}
                  className="relative aspect-card w-28 shrink-0 cursor-pointer transition hover:opacity-90 active:scale-[0.98]"
                  aria-label={t("cardModal.expandImage")}
                >
                  <CardFrame className="size-full">
                    <CardImage
                      cardId={card.id}
                      setId={card.setId}
                      officialCode={card.officialCode}
                      number={card.number}
                      alt={card.name}
                      className="h-full w-full"
                    />
                  </CardFrame>
                </button>

                <ul className="min-w-0 flex-1 space-y-2 text-sm">
                  {variantLines.map((variant) => (
                    <li
                      key={variant.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <span className="text-zinc-200">{variant.label}</span>
                      <span className="shrink-0 text-zinc-400">{variant.price}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {needsSetDownload ? (
              card.setId ? (
                <ButtonLink
                  href={`/sets/${card.setId}`}
                  variant="outline"
                  fullWidth
                  onClick={handleClose}
                >
                  {t("cardModal.goToSet")}
                </ButtonLink>
              ) : null
            ) : (
              <Button
                variant="outline"
                fullWidth
                className="border-emerald-500/30"
                icon={<ListPlus className="h-4 w-4 shrink-0" />}
                onClick={() => setChecklistOpen(true)}
              >
                {t("sets.addToChecklist")}
              </Button>
            )}
          </div>
        </div>
      </Portal>

      <CardImageLightbox
        open={imageExpanded}
        cardId={card.id}
        setId={card.setId}
        number={card.number}
        alt={card.name}
        onClose={() => setImageExpanded(false)}
      />

      <AddToChecklistSheet
        cardId={card.id}
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        onSaved={handleChecklistSaved}
      />
    </>
  );
}
