"use client";

import Image from "next/image";
import { useState } from "react";
import { CardImageFallback } from "@/components/card-image-fallback";
import { getCardImageApiPath } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type CardImageProps = {
  cardId?: string | null;
  setId?: string | null;
  number?: string | null;
  alt: string;
  className?: string;
  bare?: boolean;
};

export function CardImage({
  cardId,
  setId,
  number,
  alt,
  className,
  bare = false,
}: CardImageProps) {
  const [failedCardId, setFailedCardId] = useState<string | null>(null);

  const useFallback = !cardId || failedCardId === cardId;

  return (
    <div
      className={cn(
        "pointer-events-none relative h-full w-full select-none overflow-hidden [-webkit-touch-callout:none] [-webkit-user-drag:none]",
        !bare && "ring-1 ring-white/15",
        className,
      )}
    >
      {useFallback ? (
        <CardImageFallback setId={setId} number={number} className="h-full w-full" />
      ) : (
        <Image
          src={getCardImageApiPath(cardId)}
          alt={alt}
          fill
          draggable={false}
          sizes={bare ? "90vw" : "(max-width: 768px) 33vw, 120px"}
          className="pointer-events-none object-contain select-none [-webkit-user-drag:none]"
          onDragStart={(event) => event.preventDefault()}
          onError={() => cardId && setFailedCardId(cardId)}
        />
      )}
    </div>
  );
}
