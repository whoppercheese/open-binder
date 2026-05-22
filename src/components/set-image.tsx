"use client";

import Image from "next/image";
import { useState } from "react";
import { getSetImageApiPath, type SetImageKind } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type SetImageProps = {
  setId: string;
  alt: string;
  className?: string;
};

export function SetImage({ setId, alt, className }: SetImageProps) {
  const [kind, setKind] = useState<SetImageKind>("logo");
  const [failed, setFailed] = useState(false);

  const src = failed ? null : getSetImageApiPath(setId, kind);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-zinc-900/80 ring-1 ring-white/10",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="48px"
          className={cn(
            "object-contain p-1.5",
            kind === "logo" ? "p-1" : "p-2",
          )}
          onError={() => {
            if (kind === "logo") {
              setKind("symbol");
              return;
            }
            setFailed(true);
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
