"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Layers, ListPlus } from "lucide-react";
import { AddToChecklistSheet } from "@/components/add-to-checklist-sheet";
import { Button } from "@/components/ui/button";
import { FullWidthIconRow } from "@/components/ui/full-width-row";
import { TextLink } from "@/components/ui/text-link";
import { SheetCloseButton } from "@/components/ui/icon-button";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { CardImageLightbox } from "@/components/card-image-lightbox";
import { Portal } from "@/components/portal";
import type { CardDetail } from "@/components/card-modal";
import { writeChecklistCountOverride } from "@/lib/checklist-count-overrides.client";
import { ensureAndLoadCardClient, loadCardDetailClient } from "@/lib/ensure-cards.client";
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
  const [ensuredCard, setEnsuredCard] = useState<CardDetail | null>(null);
  const [catalogLookup, setCatalogLookup] = useState<{
    cardId: string;
    card: CardDetail | null;
  } | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistCountState, setChecklistCountState] = useState<{
    cardId: string;
    count: number;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const catalogCard =
    catalogLookup != null && catalogLookup.cardId === card?.id
      ? catalogLookup.card
      : null;
  const cardData = catalogCard ?? ensuredCard ?? card;
  const catalogCheckPending =
    open &&
    card != null &&
    card.variants.length === 0 &&
    catalogLookup?.cardId !== card.id;
  const checklistCount =
    cardData && checklistCountState?.cardId === cardData.id
      ? checklistCountState.count
      : null;

  useEffect(() => {
    if (!open || !card || card.variants.length > 0) {
      return;
    }

    const cardId = card.id;
    if (catalogLookup?.cardId === cardId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const loaded = await loadCardDetailClient(cardId, locale);
        if (cancelled) {
          return;
        }
        setCatalogLookup({
          cardId,
          card: loaded.variants.length > 0 ? loaded : null,
        });
      } catch {
        if (!cancelled) {
          setCatalogLookup({ cardId, card: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, card, locale, catalogLookup?.cardId]);

  useEffect(() => {
    if (!open || !cardData) {
      return;
    }

    const cardId = cardData.id;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/cards/${cardId}/checklist`, locale),
        );
        const payload = await response.json();
        if (!response.ok || cancelled) {
          return;
        }
        const collections: Array<{ onChecklist?: boolean }> =
          payload.collections ?? [];
        setChecklistCountState({
          cardId,
          count: collections.filter((item) => item.onChecklist).length,
        });
      } catch {
        // Keep prior count hidden until a successful load for this card.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cardData, locale]);

  const setLabel = cardData
    ? resolveSetDisplayCode({
        officialCode: cardData.officialCode,
        setId: cardData.setId,
      })
    : null;

  const rarityLabel = rarity ? getRarityLabel(rarity, t) ?? rarity : null;

  const variantLines = useMemo(() => {
    if (!cardData) return [];
    return cardData.variants.map((variant) => {
      const key = VARIANT_KEYS[variant.variantType];
      const label = key ? t(key) : variant.variantType;
      return {
        id: variant.id,
        label,
        price: formatCardPriceLabel(variant.price, t("common.price"), locale),
      };
    });
  }, [cardData, locale, t]);

  function handleClose() {
    setImageExpanded(false);
    setChecklistOpen(false);
    setEnsuredCard(null);
    setCatalogLookup(null);
    setChecklistCountState(null);
    setDownloadError(null);
    setDownloading(false);
    onClose();
  }

  async function handleDownloadCard() {
    if (!cardData || downloading) {
      return;
    }

    setDownloading(true);
    setDownloadError(null);

    try {
      const loadedCard = await ensureAndLoadCardClient(cardData.id, locale);
      setEnsuredCard(loadedCard);
      setCatalogLookup({ cardId: loadedCard.id, card: loadedCard });
    } catch {
      setDownloadError(t("cardModal.downloadCardFailed"));
    } finally {
      setDownloading(false);
    }
  }

  function handleChecklistSaved(count: number) {
    if (cardData) {
      writeChecklistCountOverride(cardData.id, count);
      onChecklistChanged?.(cardData.id, count);
    }
    handleClose();
  }

  if (!open || !cardData) return null;

  const needsSetDownload = cardData.variants.length === 0;
  const showDownloadUi = needsSetDownload && !catalogCheckPending;

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
                    cardData.setId ? (
                      <Link
                        href={`/sets/${cardData.setId}`}
                        onClick={handleClose}
                        className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20 hover:text-emerald-300"
                      >
                        {setLabel}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400">
                        {setLabel}
                      </span>
                    )
                  ) : null}
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-sm font-medium tabular-nums text-zinc-200">
                    {cardData.number}
                  </span>
                  {rarityLabel ? (
                    <span className="text-xs text-zinc-500">{rarityLabel}</span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold text-white">{cardData.name}</h2>
                {checklistCount !== null && checklistCount > 0 ? (
                  <TextLink
                    href={`/collections?cardId=${encodeURIComponent(cardData.id)}`}
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
                      cardId={cardData.id}
                      setId={cardData.setId}
                      officialCode={cardData.officialCode}
                      number={cardData.number}
                      alt={cardData.name}
                      className="h-full w-full"
                    />
                  </CardFrame>
                </button>
                {catalogCheckPending ? (
                  <p className="w-full py-2.5 text-center text-sm text-zinc-400">
                    {t("cardModal.downloadCardPreparing")}
                  </p>
                ) : (
                  <>
                    <p className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-center text-sm text-amber-200">
                      {downloading
                        ? t("cardModal.downloadCardPreparing")
                        : t("cardModal.downloadCardHint")}
                    </p>
                    {downloadError ? (
                      <p className="w-full text-center text-sm text-red-400">{downloadError}</p>
                    ) : null}
                  </>
                )}
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
                      cardId={cardData.id}
                      setId={cardData.setId}
                      officialCode={cardData.officialCode}
                      number={cardData.number}
                      alt={cardData.name}
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

            {showDownloadUi ? (
              <div className="space-y-3">
                {cardData.setId ? (
                  <FullWidthIconRow
                    href={`/sets/${cardData.setId}`}
                    icon={Layers}
                    label={t("cardModal.goToSet")}
                    onClick={handleClose}
                  />
                ) : null}
                <Button
                  variant="primary"
                  fullWidth
                  loading={downloading}
                  icon={<Download className="h-4 w-4 shrink-0" />}
                  onClick={() => void handleDownloadCard()}
                >
                  {t("cardModal.downloadCard")}
                </Button>
              </div>
            ) : !needsSetDownload ? (
              <Button
                variant="outline"
                fullWidth
                className="border-emerald-500/30"
                icon={<ListPlus className="h-4 w-4 shrink-0" />}
                onClick={() => setChecklistOpen(true)}
              >
                {t("sets.addToChecklist")}
              </Button>
            ) : null}
          </div>
        </div>
      </Portal>

      <CardImageLightbox
        open={imageExpanded}
        cardId={cardData.id}
        setId={cardData.setId}
        number={cardData.number}
        alt={cardData.name}
        onClose={() => setImageExpanded(false)}
      />

      <AddToChecklistSheet
        cardId={cardData.id}
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        onSaved={handleChecklistSaved}
      />
    </>
  );
}
