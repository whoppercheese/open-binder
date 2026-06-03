"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type ActiveFilterBannerProps = {
  label: ReactNode;
  value: ReactNode;
  onClear: () => void;
  clearLabel: string;
  className?: string;
};

export function ActiveFilterBanner({
  label,
  value,
  onClear,
  clearLabel,
  className,
}: ActiveFilterBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-accent-text-soft",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-accent-text/80">
          {label}
        </p>
        <p className="truncate font-medium">{value}</p>
      </div>
      <IconButton
        variant="clear"
        onClick={onClear}
        aria-label={clearLabel}
      >
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
