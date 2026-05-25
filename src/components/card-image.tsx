"use client";

import { useEffect, useMemo, useState } from "react";
import { CardImageFallback } from "@/components/card-image-fallback";
import { getCardImageApiPath, getTcgdexEnglishImageUrl } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type CardImageProps = {
  cardId?: string | null;
  setId?: string | null;
  officialCode?: string | null;
  number?: string | null;
  remoteImageUrl?: string | null;
  alt: string;
  className?: string;
  bare?: boolean;
};

export function CardImage({
  cardId,
  setId,
  officialCode,
  number,
  remoteImageUrl,
  alt,
  className,
  bare = false,
}: CardImageProps) {
  const [localFailed, setLocalFailed] = useState(false);
  const [remoteAttempt, setRemoteAttempt] = useState(0);
  const [remoteExhausted, setRemoteExhausted] = useState(false);

  const remoteCandidates = useMemo(() => {
    const candidates: string[] = [];
    if (remoteImageUrl) {
      candidates.push(remoteImageUrl);
      const englishFallback = getTcgdexEnglishImageUrl(remoteImageUrl);
      if (englishFallback && englishFallback !== remoteImageUrl) {
        candidates.push(englishFallback);
      }
    }
    return candidates;
  }, [remoteImageUrl]);

  const activeRemoteUrl = remoteCandidates[remoteAttempt] ?? null;

  useEffect(() => {
    setLocalFailed(false);
    setRemoteAttempt(0);
    setRemoteExhausted(false);
  }, [cardId, remoteImageUrl]);

  const localSource = cardId ? getCardImageApiPath(cardId) : null;
  const imageSource =
    localSource && !localFailed
      ? localSource
      : activeRemoteUrl && !remoteExhausted
        ? activeRemoteUrl
        : null;
  const useFallback = !imageSource;

  function handleImageError(failedSource: string) {
    if (failedSource === localSource) {
      setLocalFailed(true);
      return;
    }

    if (
      activeRemoteUrl &&
      failedSource === activeRemoteUrl &&
      remoteAttempt < remoteCandidates.length - 1
    ) {
      setRemoteAttempt((current) => current + 1);
      return;
    }

    setRemoteExhausted(true);
  }

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
        // Native img: reliable onError for local 404 JSON and remote TCGdex misses.
        <img
          key={imageSource}
          src={imageSource}
          alt={alt}
          draggable={false}
          className={cn("absolute inset-0 h-full w-full", imageClassName)}
          onDragStart={(event) => event.preventDefault()}
          onError={() => handleImageError(imageSource)}
        />
      )}
    </div>
  );
}
