"use client";

import { useCallback, useEffect, useState } from "react";
import { Portal } from "@/components/portal";
import { Button } from "@/components/ui/button";
import { SheetCloseButton } from "@/components/ui/icon-button";
import {
  translateCollectionError,
  updateCollectionName,
} from "@/lib/collection-client";
import { useTranslations } from "@/lib/i18n/context";

type RenameCollectionSheetProps = {
  open: boolean;
  collectionId: string;
  currentName: string;
  onClose: () => void;
  onSaved: (update: { name: string; updatedAt: string }) => void;
};

export function RenameCollectionSheet({
  open,
  collectionId,
  currentName,
  onClose,
  onSaved,
}: RenameCollectionSheetProps) {
  const t = useTranslations();
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName(currentName);
    setError(null);
    setLoading(false);
  }, [currentName]);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setLoading(false);
    }
  }, [currentName, open]);

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("collections.nameRequired"));
      return;
    }
    if (trimmed === currentName.trim()) {
      handleClose();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const update = await updateCollectionName(collectionId, trimmed);
      onSaved(update);
      handleClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : undefined;
      setError(
        code === "NAME_REQUIRED"
          ? t("collections.nameRequired")
          : translateCollectionError(code, t, "collections.errorRename"),
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex cursor-pointer items-end justify-center bg-black/70 sm:items-center sm:p-4"
        onClick={handleClose}
      >
        <div
          className="w-full max-w-md cursor-auto rounded-t-3xl border border-white/10 bg-[#151922] p-4 shadow-2xl sm:rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {t("collections.renameTitle")}
            </h2>
            <SheetCloseButton onClick={handleClose} />
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-zinc-400">
              {t("collections.nameLabel")}
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("collections.namePlaceholder")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-accent/50"
                autoFocus
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="cancel" className="flex-1" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={loading}
                onClick={() => void handleSave()}
              >
                {t("collections.renameConfirm")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
