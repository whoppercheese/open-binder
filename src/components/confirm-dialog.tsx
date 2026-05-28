"use client";

import { Portal } from "@/components/portal";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/context";

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
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useTranslations();

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
          <Button
            variant="cancel"
            className="flex-1 text-white"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.delete")}
          </Button>
        </div>
        </div>
      </div>
    </Portal>
  );
}
