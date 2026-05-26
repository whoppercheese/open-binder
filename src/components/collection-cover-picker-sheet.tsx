"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { CardGrid } from "@/components/card-grid";
import { CardTile } from "@/components/card-tile";
import { Portal } from "@/components/portal";
import {
  setCollectionCover,
  translateCollectionError,
  type CollectionCoverUpdate,
} from "@/lib/collection-client";
import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type CoverPickerCard = {
  id: string;
  number: string;
  name: string;
  setId: string;
  imageUrl: string | null;
  officialCode: string | null;
};

type CollectionCoverPickerSheetProps = {
  open: boolean;
  collectionId: string;
  cards: CoverPickerCard[];
  selectedCardId?: string | null;
  onClose: () => void;
  onSaved: (update: CollectionCoverUpdate) => void;
};

export function CollectionCoverPickerSheet({
  open,
  collectionId,
  cards,
  selectedCardId,
  onClose,
  onSaved,
}: CollectionCoverPickerSheetProps) {
  const t = useTranslations();
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleSelect(cardId: string) {
    if (savingCardId || cardId === selectedCardId) {
      onClose();
      return;
    }

    setSavingCardId(cardId);
    setError(null);
    try {
      const update = await setCollectionCover(collectionId, cardId);
      onSaved(update);
      onClose();
    } catch (caught) {
      const code =
        caught instanceof Error ? caught.message : "SAVE_FAILED";
      setError(translateCollectionError(code, t));
    } finally {
      setSavingCardId(null);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
        <button
          type="button"
          aria-label={t("common.close")}
          className="absolute inset-0"
          onClick={onClose}
        />
        <div
          className={cn(
            "relative z-10 flex max-h-[85dvh] flex-col rounded-t-3xl border border-white/10 bg-zinc-950",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <h2 className="text-lg font-semibold text-white">
              {t("collections.coverPickerTitle")}
            </h2>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
            {savingCardId ? (
              <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("collections.coverSaving")}
              </div>
            ) : null}
            <CardGrid className="grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {cards.map((card) => {
                const isSelected = card.id === selectedCardId;
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "transition-opacity",
                      !isSelected && "opacity-65 hover:opacity-85",
                    )}
                  >
                    <CardTile
                      compact
                      showMeta={false}
                      selected={isSelected}
                      card={{
                        id: card.id,
                        number: card.number,
                        name: card.name,
                        setId: card.setId,
                        imageUrl: card.imageUrl,
                        officialCode: card.officialCode,
                      }}
                      onClick={() => void handleSelect(card.id)}
                    />
                  </div>
                );
              })}
            </CardGrid>
          </div>
        </div>
      </div>
    </Portal>
  );
}
