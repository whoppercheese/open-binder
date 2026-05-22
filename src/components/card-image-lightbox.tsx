"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { CardImage } from "@/components/card-image";

type CardImageLightboxProps = {
  open: boolean;
  cardId: string;
  alt: string;
  onClose: () => void;
};

export function CardImageLightbox({
  open,
  cardId,
  alt,
  onClose,
}: CardImageLightboxProps) {
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
    <div
      className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/90 p-4 pb-24 pt-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
        aria-label="Vergrößertes Bild schließen"
      >
        <X className="h-6 w-6" />
      </button>
      <div
        className="relative aspect-[2.5/3.5] w-[min(90vw,calc((100dvh-8rem)*2.5/3.5))] shrink-0 cursor-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <CardImage cardId={cardId} alt={alt} bare className="h-full w-full" />
      </div>
    </div>
  );
}
