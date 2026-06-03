"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type CreatedChecklistCollection = {
  id: string;
  name: string;
  type: "custom";
  setId: null;
  imageUrl: null;
  coverImageUrl: null;
  onChecklist: false;
  locked: false;
};

type ChecklistCreateCollectionInlineProps = {
  onCreated: (collection: CreatedChecklistCollection) => void;
  disabled?: boolean;
};

export function ChecklistCreateCollectionInline({
  onCreated,
  disabled = false,
}: ChecklistCreateCollectionInlineProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setExpanded(false);
    setName("");
    setError(null);
  }

  async function handleCreate() {
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

      const collection = payload.collection;
      if (!collection?.id || typeof collection.name !== "string") {
        setError(t("collections.errorCreate"));
        return;
      }

      onCreated({
        id: collection.id,
        name: collection.name,
        type: "custom",
        setId: null,
        imageUrl: null,
        coverImageUrl: null,
        onChecklist: false,
        locked: false,
      });
      resetForm();
    } catch {
      setError(t("collections.errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <Button
        variant="dashed"
        fullWidth
        disabled={disabled || loading}
        icon={<Plus className="h-4 w-4 shrink-0" aria-hidden />}
        onClick={() => setExpanded(true)}
      >
        {t("sets.checklistPickerCreateNew")}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {t("sets.checklistPickerCreateNew")}
      </p>
      <label className="block text-sm text-zinc-400">
        {t("collections.nameLabel")}
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("collections.namePlaceholder")}
          disabled={disabled || loading}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-accent/50 disabled:opacity-60"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreate();
            }
          }}
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          variant="cancel"
          className="flex-1 rounded-xl px-3 py-2.5"
          disabled={disabled || loading}
          onClick={resetForm}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          className="flex-1 rounded-xl px-3 py-2.5"
          loading={loading}
          disabled={disabled}
          onClick={() => void handleCreate()}
        >
          {t("collections.createConfirm")}
        </Button>
      </div>
    </div>
  );
}
