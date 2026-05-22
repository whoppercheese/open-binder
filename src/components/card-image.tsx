import Image from "next/image";
import { getCardImageApiPath } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type CardImageProps = {
  cardId?: string | null;
  alt: string;
  className?: string;
  bare?: boolean;
};

export function CardImage({ cardId, alt, className, bare = false }: CardImageProps) {
  const src = cardId ? getCardImageApiPath(cardId) : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !bare && "rounded-md ring-1 ring-white/15",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={bare ? "90vw" : "(max-width: 768px) 33vw, 120px"}
          className="object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-zinc-900/80 text-xs text-zinc-500">
          Kein Bild
        </div>
      )}
    </div>
  );
}
