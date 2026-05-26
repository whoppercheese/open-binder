"use client";

import { SetImage } from "@/components/set-image";
import { collectionCoverColor, collectionCoverInitials } from "@/lib/collection-cover";
import { cn } from "@/lib/utils";

type CollectionCoverProps = {
  name: string;
  imageUrl?: string | null;
  setId?: string | null;
  setOfficialCode?: string | null;
  className?: string;
};

export function CollectionCover({
  name,
  imageUrl,
  setId,
  setOfficialCode,
  className,
}: CollectionCoverProps) {
  const initials = collectionCoverInitials(name);
  const fallbackLabel = setOfficialCode?.trim() || initials;

  if (setId) {
    return (
      <SetImage
        setId={setId}
        alt={name}
        className={cn("shrink-0", className)}
        plain
        fallbackLabel={fallbackLabel}
      />
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn("rounded-xl object-contain bg-white/5", className)}
      />
    );
  }

  const backgroundColor = collectionCoverColor(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl font-semibold text-white",
        className,
      )}
      style={{ backgroundColor }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
