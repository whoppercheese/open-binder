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
        "flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-emerald-300/80">
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
