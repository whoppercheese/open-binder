"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { CardGrid } from "@/components/card-grid";
import { CardTile } from "@/components/card-tile";
import { Portal } from "@/components/portal";
import { SetImage } from "@/components/set-image";
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

type CoverPickerSetLogo = {
  setId: string;
  setOfficialCode: string | null;
  setName: string;
};

type CollectionCoverPickerSheetProps = {
  open: boolean;
  collectionId: string;
  cards: CoverPickerCard[];
  setLogo?: CoverPickerSetLogo | null;
  selectedCardId?: string | null;
  onClose: () => void;
  onSaved: (update: CollectionCoverUpdate) => void;
};

export function CollectionCoverPickerSheet({
  open,
  collectionId,
  cards,
  setLogo,
  selectedCardId,
  onClose,
  onSaved,
}: CollectionCoverPickerSheetProps) {
  const t = useTranslations();
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [savingSetLogo, setSavingSetLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const isSetLogoSelected = setLogo != null && selectedCardId == null;
  const isSaving = savingCardId != null || savingSetLogo;

  async function handleSelectSetLogo() {
    if (isSaving || isSetLogoSelected) {
      onClose();
      return;
    }

    setSavingSetLogo(true);
    setError(null);
    try {
      const update = await setCollectionCover(collectionId, null);
      onSaved(update);
      onClose();
    } catch (caught) {
      const code =
        caught instanceof Error ? caught.message : "SAVE_FAILED";
      setError(translateCollectionError(code, t));
    } finally {
      setSavingSetLogo(false);
    }
  }

  async function handleSelect(cardId: string) {
    if (isSaving || cardId === selectedCardId) {
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
            {isSaving ? (
              <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("collections.coverSaving")}
              </div>
            ) : null}
            <CardGrid className="grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {setLogo ? (
                <div
                  className={cn(
                    "transition-opacity",
                    !isSetLogoSelected && "opacity-65 hover:opacity-85",
                    isSetLogoSelected && "z-10 scale-[1.04]",
                  )}
                >
                  <button
                    type="button"
                    aria-label={t("collections.coverSetLogo")}
                    aria-pressed={isSetLogoSelected}
                    onClick={() => void handleSelectSetLogo()}
                    className="group relative w-full cursor-pointer select-none text-left transition-[transform,opacity] active:scale-[0.98]"
                  >
                    <SetImage
                      setId={setLogo.setId}
                      alt={setLogo.setName}
                      fallbackLabel={setLogo.setOfficialCode}
                      className={cn(
                        "aspect-[5/7] w-full text-sm",
                        isSetLogoSelected && "ring-2 ring-emerald-400/70",
                      )}
                    />
                    <p className="mt-1 truncate text-center text-[10px] text-zinc-400">
                      {t("collections.coverSetLogo")}
                    </p>
                  </button>
                </div>
              ) : null}
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
