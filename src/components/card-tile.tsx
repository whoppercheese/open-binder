"use client";

import { CheckCircle2 } from "lucide-react";
import { CardFrame } from "@/components/card-frame";
import { CardImage } from "@/components/card-image";
import { LongPressIndicator } from "@/components/long-press-indicator";
import { useLongPress } from "@/lib/use-long-press";
import { cn, formatCurrency, hasCardPrice } from "@/lib/utils";

export type CardPreview = {
  id: string;
  number: string;
  nameDe: string;
  setId?: string;
  imageUrl?: string | null;
  owned?: boolean;
  ownedQuantity?: number;
  setName?: string;
  price?: number | null;
};

type CardTileProps = {
  card: CardPreview;
  onClick?: () => void;
  onLongPress?: () => void;
  compact?: boolean;
};

export function CardTile({
  card,
  onClick,
  onLongPress,
  compact = false,
}: CardTileProps) {
  const longPress = useLongPress<HTMLButtonElement>(() => onLongPress?.(), {
    disabled: !onLongPress,
    onTap: onLongPress ? onClick : undefined,
  });

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
      className={cn(
        "group relative w-full cursor-pointer select-none text-left transition-transform active:scale-[0.98] [-webkit-touch-callout:none]",
        onLongPress ? "touch-none" : "[touch-action:manipulation]",
        onLongPress && longPress.showIndicator && "scale-100",
        compact ? "space-y-1" : "space-y-2",
      )}
    >
      <CardFrame className="aspect-card w-full">
        <LongPressIndicator
          active={Boolean(onLongPress && longPress.showIndicator)}
          durationMs={longPress.progressDurationMs}
          compact={compact}
        />
        <CardImage
          cardId={card.id}
          setId={card.setId}
          number={card.number}
          alt={card.nameDe}
          className="h-full w-full"
        />
        {card.owned ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="rounded-full bg-emerald-500 p-0.5 shadow-md shadow-black ring-2 ring-white/25">
              <CheckCircle2 className="h-8 w-8 text-black" strokeWidth={2.5} />
            </div>
          </div>
        ) : null}
        {card.ownedQuantity && card.ownedQuantity > 1 ? (
          <div className="absolute bottom-1 right-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            ×{card.ownedQuantity}
          </div>
        ) : null}
      </CardFrame>
      <div className="px-0.5">
        <p className="truncate text-[11px] font-medium text-zinc-300">
          {card.number} · {card.nameDe}
        </p>
        {!compact && card.setName ? (
          <p className="truncate text-[10px] text-zinc-500">{card.setName}</p>
        ) : null}
        <p className="text-[10px] tabular-nums">
          {hasCardPrice(card.price) ? (
            <span className="font-semibold text-emerald-400">
              {formatCurrency(card.price)}
            </span>
          ) : (
            <span className="text-zinc-500">
              <span className="font-normal">Preis </span>
              <span className="font-semibold">—</span>
            </span>
          )}
        </p>
      </div>
    </button>
  );
}
