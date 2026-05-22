import Image from "next/image";
import { resolveSetImageKind } from "@/lib/image-storage";
import { getSetImageApiPath } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type SetImageProps = {
  setId: string;
  alt: string;
  className?: string;
};

export function SetImage({ setId, alt, className }: SetImageProps) {
  const kind = resolveSetImageKind(setId);
  const src = kind ? getSetImageApiPath(setId, kind) : null;

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
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Set
        </div>
      )}
    </div>
  );
}
