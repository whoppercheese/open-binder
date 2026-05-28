"use client";

import { useMemo, useState } from "react";
import { ListPlus, X } from "lucide-react";
import { ActionSheet } from "@/components/action-sheet";
import { Portal } from "@/components/portal";
import { IconButton, IconMenuButton } from "@/components/ui/icon-button";
import { useTranslations } from "@/lib/i18n/context";

type CardSelectionToolbarProps = {
  selectedCount: number;
  onCancel: () => void;
  onAddToChecklist: () => void;
};

export function CardSelectionToolbar({
  selectedCount,
  onCancel,
  onAddToChecklist,
}: CardSelectionToolbarProps) {
  const t = useTranslations();
  const [actionsOpen, setActionsOpen] = useState(false);

  const actionItems = useMemo(
    () => [
      {
        id: "add-to-checklist",
        label: t("selection.addToChecklist"),
        icon: <ListPlus className="h-4 w-4" />,
        onSelect: onAddToChecklist,
      },
    ],
    [onAddToChecklist, t],
  );

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <Portal>
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 px-4"
          aria-live="polite"
        >
          <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-emerald-400/25 bg-[#0f1612]/95 px-3 py-2.5 shadow-xl shadow-black/40 backdrop-blur-sm">
            <IconButton
              variant="subtle"
              onClick={onCancel}
              aria-label={t("selection.cancel")}
            >
              <X className="h-5 w-5" />
            </IconButton>

            <p className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-100">
              {t.plural("selection.selectedCount", selectedCount, {
                count: selectedCount,
              })}
            </p>

            <IconMenuButton
              variant="toolbar"
              aria-label={t("selection.actions")}
              onClick={() => setActionsOpen(true)}
            />
          </div>
        </div>
      </Portal>

      <ActionSheet
        open={actionsOpen}
        title={t("selection.actions")}
        items={actionItems}
        onClose={() => setActionsOpen(false)}
      />
    </>
  );
}
