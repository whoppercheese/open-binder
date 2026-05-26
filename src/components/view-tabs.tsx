"use client";

import { cn } from "@/lib/utils";

export type ViewTabItem<T extends string> = {
  id: T;
  label: string;
};

type ViewTabsProps<T extends string> = {
  tabs: ViewTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

export function ViewTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: ViewTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-1 rounded-2xl border border-white/10 bg-[#12151c] p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
              active
                ? "bg-white/10 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_4px_12px_rgba(0,0,0,0.35)]"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
