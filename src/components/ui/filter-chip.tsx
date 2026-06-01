"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export function FilterChip({
  active,
  onClick,
  children,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

type FilterChipListProps = {
  children: ReactNode;
  className?: string;
};

/** Single horizontal row of filter chips; scrolls when content overflows. */
export function FilterChipList({ children, className }: FilterChipListProps) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
