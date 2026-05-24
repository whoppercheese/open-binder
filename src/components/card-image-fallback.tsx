"use client";

import { ImageOff } from "lucide-react";
import { SetImage } from "@/components/set-image";
import { useTranslations } from "@/lib/i18n/context";
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
  const t = useTranslations();

  return (
    <div
      className={cn(
        "pointer-events-none flex h-full select-none flex-col items-center justify-center bg-zinc-900/90 px-2 py-3 text-center [-webkit-touch-callout:none] [-webkit-user-drag:none]",
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
          {number}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-zinc-500">{t("common.noImage")}</p>
    </div>
  );
}
