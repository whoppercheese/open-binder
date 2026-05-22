"use client";

import { CheckCircle2 } from "lucide-react";
import { CardImage } from "@/components/card-image";
import { cn, formatCurrency } from "@/lib/utils";

export type CardPreview = {
  id: string;
  number: string;
  nameDe: string;
  imageUrl?: string | null;
  owned?: boolean;
  ownedQuantity?: number;
  setName?: string;
  price?: number | null;
};

type CardTileProps = {
  card: CardPreview;
  onClick?: () => void;
  compact?: boolean;
};

export function CardTile({ card, onClick, compact = false }: CardTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left transition-transform active:scale-[0.98]",
        compact ? "space-y-1" : "space-y-2",
      )}
    >
      <div className="relative aspect-[2.5/3.5] w-full">
        <CardImage
          cardId={card.id}
          alt={card.nameDe}
          owned={card.owned}
          className="h-full w-full"
        />
        {card.owned ? (
          <div className="absolute right-1 top-1 rounded-full bg-emerald-500/90 p-0.5 text-black shadow">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        ) : null}
        {card.ownedQuantity && card.ownedQuantity > 1 ? (
          <div className="absolute bottom-1 right-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            ×{card.ownedQuantity}
          </div>
        ) : null}
      </div>
      <div className="px-0.5">
        <p className="truncate text-[11px] font-medium text-zinc-300">
          {card.number} · {card.nameDe}
        </p>
        {!compact && card.setName ? (
          <p className="truncate text-[10px] text-zinc-500">{card.setName}</p>
        ) : null}
        {card.price != null ? (
          <p className="text-[10px] font-semibold text-emerald-400">
            {formatCurrency(card.price)}
          </p>
        ) : null}
      </div>
    </button>
  );
}
