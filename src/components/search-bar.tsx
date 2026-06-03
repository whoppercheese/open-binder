"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  showClear?: boolean;
  placeholder?: string;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  showClear,
  placeholder,
  className,
}: SearchBarProps) {
  const t = useTranslations();
  const canClear = onClear != null && (showClear ?? value.length > 0);

  return (
    <form
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t("common.searchDefaultPlaceholder")}
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 text-sm text-white placeholder:text-zinc-500 focus:border-accent-hover/50 focus:outline-none",
          canClear ? "pr-10" : "pr-4",
        )}
      />
      {canClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("common.clearSearch")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </form>
  );
}
