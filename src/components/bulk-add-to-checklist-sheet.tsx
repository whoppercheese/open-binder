"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import {
  ChecklistCreateCollectionInline,
  type CreatedChecklistCollection,
} from "@/components/checklist-create-collection-inline";
import { CollectionCover } from "@/components/collection-cover";
import { Portal } from "@/components/portal";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type BulkChecklistOption = {
  id: string;
  name: string;
  type: "set" | "custom";
  setId: string | null;
  imageUrl: string | null;
  coverImageUrl: string | null;
  onChecklist: boolean;
  locked: boolean;
  cardsOnChecklist: number;
  totalCards: number;
};

type BulkAddToChecklistSheetProps = {
  cardIds: string[];
  open: boolean;
  onClose: () => void;
  onSaved?: (checklistCounts: Record<string, number>) => void;
};

function CollectionTypeLabel({
  type,
  t,
}: {
  type: "set" | "custom";
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <span className="text-xs text-zinc-500">
      {type === "set" ? t("sets.collectionTypeSet") : t("collections.customLabel")}
    </span>
  );
}

function ChecklistSelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected
          ? "border-emerald-400/50 bg-emerald-500/25 text-emerald-300"
          : "border-white/20 bg-white/5 text-transparent",
      )}
      aria-hidden
    >
      <Check
        className={cn("h-4 w-4 transition-opacity", selected ? "opacity-100" : "opacity-0")}
        strokeWidth={2.5}
      />
    </span>
  );
}

function checklistRowClassName(selected: boolean) {
  return cn(
    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
    selected
      ? "border-emerald-500/35 bg-emerald-500/15"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
  );
}

export function BulkAddToChecklistSheet({
  cardIds,
  open,
  onClose,
  onSaved,
}: BulkAddToChecklistSheetProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const [options, setOptions] = useState<BulkChecklistOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState<string | null>(null);

  const uniqueCardIds = useMemo(
    () => [...new Set(cardIds.filter(Boolean))],
    [cardIds],
  );

  const load = useCallback(async () => {
    if (uniqueCardIds.length === 0) {
      setOptions([]);
      return;
    }

    setLoading(true);
    setError(null);
    setPartialFailure(null);

    try {
      const query = encodeURIComponent(uniqueCardIds.join(","));
      const response = await fetch(
        apiUrl(`/api/cards/bulk-checklist?cardIds=${query}`, locale),
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(t("bulkChecklist.loadFailed"));
        setOptions([]);
        return;
      }

      setOptions(payload.collections ?? []);
      setSelectedIds(new Set());
    } catch {
      setError(t("bulkChecklist.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [locale, t, uniqueCardIds]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const alreadyOnChecklist = useMemo(
    () => options.filter((item) => item.onChecklist),
    [options],
  );

  const addableOptions = useMemo(
    () => options.filter((item) => !item.locked),
    [options],
  );

  const hasSelection = selectedIds.size > 0;

  function toggleOption(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleCollectionCreated(collection: CreatedChecklistCollection) {
    const bulkOption: BulkChecklistOption = {
      ...collection,
      cardsOnChecklist: 0,
      totalCards: uniqueCardIds.length,
    };
    setOptions((current) => {
      if (current.some((item) => item.id === collection.id)) {
        return current;
      }
      return [...current, bulkOption];
    });
    setSelectedIds((current) => new Set([...current, collection.id]));
    setError(null);
  }

  async function handleConfirm() {
    if (!hasSelection || uniqueCardIds.length === 0) return;

    setSaving(true);
    setPreparing(true);
    setError(null);
    setPartialFailure(null);

    try {
      const response = await fetch(apiUrl("/api/cards/bulk-checklist", locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIds: uniqueCardIds,
          collectionIds: Array.from(selectedIds),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(t("bulkChecklist.addFailed"));
        return;
      }

      const failed = Array.isArray(payload.failed) ? payload.failed : [];
      if (failed.length > 0) {
        setPartialFailure(
          t.plural("bulkChecklist.partialFailure", failed.length, {
            count: failed.length,
          }),
        );
      }

      const checklistCounts =
        payload.checklistCounts && typeof payload.checklistCounts === "object"
          ? (payload.checklistCounts as Record<string, number>)
          : {};

      onSaved?.(checklistCounts);
      onClose();
    } catch {
      setError(t("bulkChecklist.addFailed"));
    } finally {
      setSaving(false);
      setPreparing(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex cursor-pointer items-end justify-center bg-black/70 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(85vh,640px)] w-full max-w-md cursor-auto flex-col rounded-t-3xl border border-white/10 bg-[#151922] shadow-2xl sm:rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-white">
              {t("bulkChecklist.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-400">
                {t("sets.checklistPickerLoading")}
              </p>
            ) : (
              <div className="space-y-4">
                {options.length === 0 ? (
                  <p className="py-2 text-center text-sm text-zinc-500">
                    {t("sets.checklistPickerEmpty")}
                  </p>
                ) : null}
                {alreadyOnChecklist.length > 0 ? (
                  <section className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                      {t("sets.checklistAlreadyAdded")}
                    </p>
                    <ul className="space-y-2">
                      {alreadyOnChecklist.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/collections/${item.id}`}
                            onClick={onClose}
                            aria-label={t("collections.openCollection", {
                              name: item.name,
                            })}
                            className={cn(
                              checklistRowClassName(true),
                              "cursor-pointer hover:bg-emerald-500/20 active:bg-emerald-500/25",
                            )}
                          >
                            <ChecklistSelectionIndicator selected />
                            <CollectionCover
                              name={item.name}
                              imageUrl={item.imageUrl}
                              coverImageUrl={item.coverImageUrl}
                              setId={item.setId}
                              className="h-10 w-10 shrink-0 text-xs"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-emerald-100">
                                {item.name}
                              </span>
                              <CollectionTypeLabel type={item.type} t={t} />
                            </span>
                            <ChevronRight
                              className="h-5 w-5 shrink-0 text-emerald-300/70"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {addableOptions.length > 0 ? (
                  <section className="space-y-2">
                    {alreadyOnChecklist.length > 0 ? (
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {t("sets.checklistPickerAddSection")}
                      </p>
                    ) : null}
                    <ul className="space-y-2">
                      {addableOptions.map((item) => {
                        const checked = selectedIds.has(item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => toggleOption(item.id)}
                              className={cn(
                                checklistRowClassName(checked),
                                "cursor-pointer",
                              )}
                            >
                              <ChecklistSelectionIndicator selected={checked} />
                              <CollectionCover
                                name={item.name}
                                imageUrl={item.imageUrl}
                                coverImageUrl={item.coverImageUrl}
                                setId={item.setId}
                                className="h-10 w-10 shrink-0 text-xs"
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "block truncate font-medium",
                                    checked ? "text-emerald-100" : "text-white",
                                  )}
                                >
                                  {item.name}
                                </span>
                                <CollectionTypeLabel type={item.type} t={t} />
                                {item.cardsOnChecklist > 0 ? (
                                  <span className="text-xs text-zinc-500">
                                    {t("bulkChecklist.partialOnChecklist", {
                                      count: item.cardsOnChecklist,
                                      total: item.totalCards,
                                    })}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
                <ChecklistCreateCollectionInline
                  onCreated={handleCollectionCreated}
                  disabled={saving}
                />
              </div>
            )}

            {preparing ? (
              <p className="mt-3 text-sm text-zinc-400">
                {t("bulkChecklist.preparingCards")}
              </p>
            ) : null}
            {partialFailure ? (
              <p className="mt-3 text-sm text-amber-300">{partialFailure}</p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              disabled={saving || !hasSelection}
              onClick={() => void handleConfirm()}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition",
                (saving || !hasSelection) && "opacity-60",
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("sets.checklistPickerConfirm")}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
