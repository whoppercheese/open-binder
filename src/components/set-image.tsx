"use client";

import Image from "next/image";
import { useState } from "react";
import { getSetImageApiPath, type SetImageKind } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type SetImageProps = {
  setId: string;
  alt: string;
  className?: string;
  plain?: boolean;
  preferSymbol?: boolean;
};

export function SetImage({
  setId,
  alt,
  className,
  plain = false,
  preferSymbol = false,
}: SetImageProps) {
  const defaultKind: SetImageKind = preferSymbol ? "symbol" : "logo";
  const [fallback, setFallback] = useState<{
    setId: string;
    preferSymbol: boolean;
    kind: SetImageKind;
    failed: boolean;
  } | null>(null);

  const active =
    fallback?.setId === setId && fallback.preferSymbol === preferSymbol
      ? fallback
      : null;
  const kind = active?.kind ?? defaultKind;
  const failed = active?.failed ?? false;

  const src = failed ? null : getSetImageApiPath(setId, kind);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        !plain && "rounded-xl bg-zinc-900/80 ring-1 ring-white/10",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="48px"
          className={cn(
            "object-contain",
            kind === "logo" ? "p-1" : "p-2",
            plain && "p-1.5",
          )}
          onError={() => {
            if (preferSymbol) {
              if (kind === "symbol") {
                setFallback({
                  setId,
                  preferSymbol,
                  kind: "logo",
                  failed: false,
                });
                return;
              }
              setFallback({ setId, preferSymbol, kind, failed: true });
              return;
            }

            if (kind === "logo") {
              setFallback({
                setId,
                preferSymbol,
                kind: "symbol",
                failed: false,
              });
              return;
            }
            setFallback({ setId, preferSymbol, kind, failed: true });
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Set
        </div>
      )}
    </div>
  );
}
