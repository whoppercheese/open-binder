"use client";

import { ImageOff } from "lucide-react";
import { SetImage } from "@/components/set-image";
import { cn } from "@/lib/utils";

type CardImageFallbackProps = {
  setId?: string | null;
  number?: string | null;
  className?: string;
};

export function CardImageFallback({
  setId,
  number,
  className,
}: CardImageFallbackProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center bg-zinc-900/90 px-2 py-3 text-center",
        className,
      )}
    >
      {setId ? (
        <SetImage
          setId={setId}
          alt=""
          plain
          preferSymbol
          className="h-14 w-14 sm:h-16 sm:w-16"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-500">
          <ImageOff className="h-6 w-6" aria-hidden />
        </div>
      )}
      {number ? (
        <p className="mt-2 text-xs font-semibold tabular-nums text-zinc-200">
          #{number}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-zinc-500">Kein Bild</p>
    </div>
  );
}
