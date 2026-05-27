"use client";

import { useState } from "react";
import { CardImageFallback } from "@/components/card-image-fallback";
import { useLocale } from "@/lib/i18n/context";
import { getCardImageApiPath } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type CardImageProps = {
  cardId?: string | null;
  setId?: string | null;
  officialCode?: string | null;
  number?: string | null;
  alt: string;
  className?: string;
  bare?: boolean;
};

export function CardImage({
  cardId,
  setId,
  officialCode,
  number,
  alt,
  className,
  bare = false,
}: CardImageProps) {
  const { locale } = useLocale();
  const [failed, setFailed] = useState(false);

  const imageIdentity = `${cardId ?? ""}|${locale}`;
  const [trackedIdentity, setTrackedIdentity] = useState(imageIdentity);
  if (trackedIdentity !== imageIdentity) {
    setTrackedIdentity(imageIdentity);
    setFailed(false);
  }

  const imageSource = cardId && !failed ? getCardImageApiPath(cardId, locale) : null;
  const useFallback = !imageSource;

  const imageClassName =
    "pointer-events-none object-contain select-none [-webkit-user-drag:none]";

  return (
    <div
      className={cn(
        "pointer-events-none relative h-full w-full select-none overflow-hidden [-webkit-touch-callout:none] [-webkit-user-drag:none]",
        !bare && "ring-1 ring-white/15",
        className,
      )}
    >
      {useFallback ? (
        <CardImageFallback
          setId={setId}
          officialCode={officialCode}
          number={number}
          className="h-full w-full"
        />
      ) : (
        <img
          key={imageSource}
          src={imageSource}
          alt={alt}
          draggable={false}
          className={cn("absolute inset-0 h-full w-full", imageClassName)}
          onDragStart={(event) => event.preventDefault()}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
