"use client";

import Link from "next/link";
import { CheckCircle2, ListChecks, WalletCards } from "lucide-react";
import { CardFlagBadge } from "@/components/card-flag-badge";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { LongPressIndicator } from "@/components/long-press-indicator";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { useLongPress } from "@/lib/use-long-press";
import {
  cn,
  formatCurrency,
  hasCardPrice,
  resolveSetDisplayCode,
} from "@/lib/utils";

export type CardPreview = {
  id: string;
  number: string;
  name: string;
  setId?: string;
  imageUrl?: string | null;
  owned?: boolean;
  ownedQuantity?: number;
  flagged?: boolean;
  setName?: string;
  officialCode?: string | null;
  collectionName?: string;
  checklistCount?: number;
  price?: number | null;
};

type CardTileProps = {
  card: CardPreview;
  href?: string;
  onClick?: () => void;
  onLongPress?: () => void;
  /** When false, long-press timers are off but tap/release handling stays active. */
  longPressActive?: boolean;
  longPressPreset?: "quickAdd" | "select";
  compact?: boolean;
  showPrice?: boolean;
  showMeta?: boolean;
  selected?: boolean;
  /** Keep the owned overlay when an inventory count badge is shown (e.g. checklist tab). */
  showOwnedOverlayWithInventoryCount?: boolean;
};

const LONG_PRESS_PRESETS = {
  quickAdd: { indicatorDelay: 200, holdDuration: 1000, icon: "markOwned" as const },
  select: { indicatorDelay: 150, holdDuration: 450, icon: "check" as const },
};

export function CardTile({
  card,
  href,
  onClick,
  onLongPress,
  longPressActive = true,
  longPressPreset = "quickAdd",
  compact = false,
  showPrice = true,
  showMeta = true,
  selected = false,
  showOwnedOverlayWithInventoryCount = false,
}: CardTileProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const preset = LONG_PRESS_PRESETS[longPressPreset];
  const longPress = useLongPress<HTMLButtonElement>(() => onLongPress?.(), {
    disabled: !onLongPress || Boolean(href),
    longPressEnabled: longPressActive,
    onTap: onLongPress ? onClick : undefined,
    indicatorDelay: preset.indicatorDelay,
    holdDuration: preset.holdDuration,
  });

  const setIdFallback = (() => {
    const id = card.setId?.trim();
    if (id) return id;
    const separator = card.id.lastIndexOf("-");
    return separator > 0 ? card.id.slice(0, separator) : card.id;
  })();

  const setLabel = resolveSetDisplayCode({
    officialCode: card.officialCode,
    setId: setIdFallback,
  });
  const rootClassName = cn(
    "group relative w-full cursor-pointer select-none text-left transition-[transform,opacity] active:scale-[0.98] [-webkit-touch-callout:none] [touch-action:pan-y]",
    onLongPress && longPress.showIndicator && "scale-100 touch-none",
    compact && showMeta ? "space-y-1" : compact ? "" : "space-y-2",
    selected && "z-10 scale-[1.04] active:scale-[1.02]",
  );

  const content = (
    <>
      <CardFrame className="aspect-card w-full">
        <LongPressIndicator
          active={Boolean(onLongPress && longPress.showIndicator)}
          durationMs={longPress.progressDurationMs}
          compact={compact}
          icon={preset.icon}
        />
        <CardImage
          cardId={card.id}
          setId={setIdFallback}
          officialCode={card.officialCode}
          number={card.number}
          alt={card.name}
          className="h-full w-full"
        />
        {selected ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-[4px] border-emerald-400"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-black ring-2 ring-white/90"
              aria-hidden
            >
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </>
        ) : null}
        {card.flagged ? (
          <CardFlagBadge className="pointer-events-none absolute left-1 top-1 z-10" />
        ) : null}
        {(card.ownedQuantity != null && card.ownedQuantity > 0) ||
        (card.checklistCount != null && card.checklistCount > 0) ? (
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 flex flex-col items-end gap-0.5">
            {card.ownedQuantity != null && card.ownedQuantity > 0 ? (
              <div
                className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-1 text-[11px] font-semibold text-zinc-200"
                title={t.plural("common.copyCount", card.ownedQuantity, {
                  count: card.ownedQuantity,
                })}
                aria-label={t.plural("common.copyCount", card.ownedQuantity, {
                  count: card.ownedQuantity,
                })}
              >
                <WalletCards className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums">{card.ownedQuantity}</span>
              </div>
            ) : null}
            {card.checklistCount != null && card.checklistCount > 0 ? (
              <div
                className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-1 text-[11px] font-semibold text-zinc-200"
                title={t.plural("sets.checklistTileCount", card.checklistCount, {
                  count: card.checklistCount,
                })}
                aria-label={t.plural(
                  "sets.checklistTileCount",
                  card.checklistCount,
                  {
                    count: card.checklistCount,
                  },
                )}
              >
                <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums">{card.checklistCount}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {card.owned &&
        (showOwnedOverlayWithInventoryCount ||
          !(card.ownedQuantity != null && card.ownedQuantity > 0)) ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="rounded-full bg-emerald-500 p-0.5 shadow-md shadow-black ring-2 ring-white/25">
              <CheckCircle2 className="h-8 w-8 text-black" strokeWidth={2.5} />
            </div>
          </div>
        ) : null}
      </CardFrame>
      {showMeta ? (
      <div className="px-0.5">
        {compact ? (
          <>
            <p className="truncate text-[11px] font-medium text-zinc-300">
              {card.name}
            </p>
            <p className="truncate text-[10px] text-zinc-500">
              {[setLabel, card.number].filter(Boolean).join(" · ")}
            </p>
            {card.collectionName ? (
              <p className="truncate text-[10px] font-medium text-emerald-400/90">
                {card.collectionName}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="truncate text-[11px] font-medium text-zinc-300">
              {card.number} · {card.name}
            </p>
            {setLabel ? (
              <p className="truncate text-[10px] text-zinc-500">{setLabel}</p>
            ) : null}
            {card.collectionName ? (
              <p className="truncate text-[10px] font-medium text-emerald-400/90">
                {card.collectionName}
              </p>
            ) : null}
          </>
        )}
        {showPrice ? (
          <p className="text-[10px] tabular-nums">
            {hasCardPrice(card.price) ? (
              <span className="font-semibold text-emerald-400">
                {formatCurrency(card.price, "EUR", locale)}
              </span>
            ) : (
              <span className="text-zinc-500">
                <span className="font-normal">{t("common.price")} </span>
                <span className="font-semibold">{t("common.priceUnavailable")}</span>
              </span>
            )}
          </p>
        ) : null}
      </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rootClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      ref={onLongPress ? longPress.ref : undefined}
      onClick={onLongPress ? undefined : onClick}
      onPointerDown={onLongPress ? longPress.onPointerDown : undefined}
      onPointerMove={onLongPress ? longPress.onPointerMove : undefined}
      onPointerUp={onLongPress ? longPress.onPointerUp : undefined}
      onPointerCancel={onLongPress ? longPress.onPointerCancel : undefined}
      onContextMenu={onLongPress ? longPress.onContextMenu : undefined}
      className={rootClassName}
    >
      {content}
    </button>
  );
}
