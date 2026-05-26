"use client";

import { SetImage } from "@/components/set-image";
import { collectionCoverColor, collectionCoverInitials, collectionCoverShellClassName } from "@/lib/collection-cover";
import { cn } from "@/lib/utils";

type CollectionCoverProps = {
  name: string;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  setId?: string | null;
  setOfficialCode?: string | null;
  className?: string;
};

export function CollectionCover({
  name,
  imageUrl,
  coverImageUrl,
  setId,
  setOfficialCode,
  className,
}: CollectionCoverProps) {
  const initials = collectionCoverInitials(name);
  const fallbackLabel = setOfficialCode?.trim() || initials;
  const resolvedCoverUrl = coverImageUrl ?? imageUrl;

  if (resolvedCoverUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-zinc-900/80",
          collectionCoverShellClassName,
          className,
        )}
      >
        <img
          key={resolvedCoverUrl}
          src={resolvedCoverUrl}
          alt=""
          className="h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  if (setId) {
    return (
      <SetImage
        setId={setId}
        alt={name}
        className={cn("shrink-0", className)}
        fallbackLabel={fallbackLabel}
      />
    );
  }

  const backgroundColor = collectionCoverColor(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center font-semibold text-white",
        collectionCoverShellClassName,
        className,
      )}
      style={{ backgroundColor }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
