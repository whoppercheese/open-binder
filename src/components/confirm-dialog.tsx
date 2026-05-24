"use client";

import { Loader2 } from "lucide-react";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string | string[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Löschen",
  cancelLabel = "Abbrechen",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const messageParts = Array.isArray(message) ? message : [message];

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151922] p-4 shadow-2xl"
        >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div
          id="confirm-dialog-message"
          className="mt-2 space-y-2 text-sm text-zinc-400"
        >
          {messageParts.map((part, index) => (
            <p key={index}>{part}</p>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-400 transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-60",
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
        </div>
      </div>
    </Portal>
  );
}
