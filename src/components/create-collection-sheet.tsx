"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Portal } from "@/components/portal";
import { Button } from "@/components/ui/button";
import { FullWidthRow } from "@/components/ui/full-width-row";
import { SheetCloseButton } from "@/components/ui/icon-button";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { notifyFullMirror } from "@/lib/offline/types";
type CreateCollectionSheetProps = {
  open: boolean;
  onClose: () => void;
  initialMode?: "choose" | "custom" | "set";
  setId?: string;
  defaultName?: string;
};

export function CreateCollectionSheet({
  open,
  onClose,
  initialMode = "choose",
  setId,
  defaultName,
}: CreateCollectionSheetProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const [mode, setMode] = useState<"choose" | "custom" | "set">(
    setId ? "set" : initialMode,
  );
  const [name, setName] = useState(defaultName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMode(setId ? "set" : "choose");
    setName(defaultName ?? "");
    setError(null);
    setLoading(false);
  }, [defaultName, setId]);

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreateSet() {
    if (!setId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/collections", locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "set",
          setId,
          name: name.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(
          payload.errorCode === "SET_NOT_SYNCED"
            ? t("collections.errorSetNotSynced")
            : t("collections.errorCreate"),
        );
        return;
      }
      notifyFullMirror();
      handleClose();
      router.push(`/collections/${payload.collection.id}`);
    } catch {
      setError(t("collections.errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustom() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("collections.nameRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/collections", locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "custom", name: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(t("collections.errorCreate"));
        return;
      }
      notifyFullMirror();
      handleClose();
      router.push(`/collections/${payload.collection.id}`);
    } catch {
      setError(t("collections.errorCreate"));
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
              {mode === "choose"
                ? t("collections.createTitle")
                : mode === "set"
                  ? t("collections.createFromSet")
                  : t("collections.createCustom")}
            </h2>
            <SheetCloseButton onClick={handleClose} />
          </div>

          {mode === "choose" ? (
            <div className="space-y-2">
              <FullWidthRow
                variant="neutral"
                className="text-left text-white"
                onClick={() => setMode("custom")}
              >
                {t("collections.createCustom")}
              </FullWidthRow>
              <FullWidthRow
                variant="emeraldNav"
                className="text-left"
                onClick={() => {
                  handleClose();
                  router.push("/sets");
                }}
              >
                <span>{t("collections.createFromSet")}</span>
              </FullWidthRow>
            </div>
          ) : (
            <div className="space-y-3">
              {mode === "set" && defaultName ? (
                <p className="text-sm text-zinc-400">
                  {t("collections.createFromSetHint", { setName: defaultName })}
                </p>
              ) : null}
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
                {!setId ? (
                  <Button
                    variant="cancel"
                    className="flex-1"
                    onClick={() => setMode("choose")}
                  >
                    {t("common.cancel")}
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  loading={loading}
                  className="flex-1"
                  onClick={
                    mode === "set" ? handleCreateSet : handleCreateCustom
                  }
                >
                  {t("collections.createConfirm")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
