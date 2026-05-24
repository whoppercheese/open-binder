"use client";

import { type ReactNode } from "react";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

export type ActionSheetItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type ActionSheetProps = {
  open: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
};

export function ActionSheet({
  open,
  title,
  items,
  onClose,
}: ActionSheetProps) {
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end">
        <button
          type="button"
          aria-label="Schließen"
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
        />
        <div
          role="menu"
          className="relative mx-auto w-full max-w-lg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151922] shadow-2xl">
            {title ? (
              <p className="border-b border-white/5 px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
                {title}
              </p>
            ) : null}
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  onClose();
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 bg-transparent px-4 py-3.5 text-sm font-medium transition",
                  index > 0 && "border-t border-white/5",
                  item.disabled
                    ? "cursor-not-allowed text-zinc-600"
                    : item.destructive
                      ? "text-red-400 hover:bg-[#1c212d]"
                      : "text-white hover:bg-[#1c212d]",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#151922] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1c212d]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </Portal>
  );
}
