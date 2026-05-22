import Image from "next/image";
import { getCardImageApiPath } from "@/lib/image-paths";
import { cn } from "@/lib/utils";

type CardImageProps = {
  cardId?: string | null;
  alt: string;
  className?: string;
  owned?: boolean;
};

export function CardImage({ cardId, alt, className, owned = false }: CardImageProps) {
  const src = cardId ? getCardImageApiPath(cardId) : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-zinc-900/80 ring-1 ring-white/10",
        !owned && "opacity-45 grayscale",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 33vw, 120px"
          className="object-contain p-1"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
          Kein Bild
        </div>
      )}
    </div>
  );
}
