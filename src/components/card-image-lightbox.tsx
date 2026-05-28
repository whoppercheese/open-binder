"use client";

import { useEffect } from "react";
import { CardFrame } from "@/components/card-frame";
import { SheetCloseButton } from "@/components/ui/icon-button";
import { CardImage } from "@/components/card-image";
import { LightboxZoomViewport } from "@/components/lightbox-zoom-viewport";
import { Portal } from "@/components/portal";
import { useTranslations } from "@/lib/i18n/context";

type CardImageLightboxProps = {
  open: boolean;
  cardId: string;
  setId?: string | null;
  number?: string | null;
  alt: string;
  onClose: () => void;
};

export function CardImageLightbox({
  open,
  cardId,
  setId,
  number,
  alt,
  onClose,
}: CardImageLightboxProps) {
  const t = useTranslations();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/90 p-4"
        onClick={onClose}
      >
        <SheetCloseButton
          onClick={onClose}
          aria-label={t("common.closeLightbox")}
          className="absolute right-4 top-4 z-10 text-zinc-300 hover:text-white"
        />
        <LightboxZoomViewport
          key={cardId}
          className="card-lightbox relative shrink-0 cursor-auto"
        >
          <CardFrame className="size-full">
            <CardImage
              cardId={cardId}
              setId={setId}
              number={number}
              alt={alt}
              bare
              className="h-full w-full"
            />
          </CardFrame>
        </LightboxZoomViewport>
      </div>
    </Portal>
  );
}
