"use client";

import Link from "next/link";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { SetImage } from "@/components/set-image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/context";
import { formatSyncJobMessage } from "@/lib/sync-job-display";
import { getSetReleaseYear } from "@/lib/utils";

type SetListItemProps = {
  id: string;
  name: string;
  officialCode?: string | null;
  releaseDate?: string | null;
  cardsSynced: boolean;
  syncStatus?: "idle" | "pending" | "running";
  syncMessage?: string | null;
  cardCount?: number;
  onLoadCards?: (setId: string) => void;
  loadingCards?: boolean;
};

export function SetListItem({
  id,
  name,
  officialCode,
  releaseDate,
  cardsSynced,
  syncStatus = "idle",
  syncMessage,
  cardCount = 0,
  onLoadCards,
  loadingCards = false,
}: SetListItemProps) {
  const t = useTranslations();
  const isSyncing = syncStatus === "pending" || syncStatus === "running";
  const showChevron = cardsSynced && !isSyncing;
  const cardCountLabel =
    cardsSynced && cardCount > 0
      ? t.plural("common.cardCount", cardCount, { count: cardCount })
      : null;
  const releaseYear = getSetReleaseYear(releaseDate);
  const subtitleParts = [officialCode, releaseYear].filter(Boolean);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
      <Link
        href={`/sets/${id}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-hover/50"
        aria-label={t("sets.openSet", { name })}
      />

      <div className="pointer-events-none relative z-[1] p-4">
        <div className="flex items-center gap-3">
          <SetImage setId={id} alt={name} className="h-12 w-12 shrink-0" />

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{name}</h3>
            {subtitleParts.length > 0 ? (
              <p className="text-xs text-zinc-500">{subtitleParts.join(" · ")}</p>
            ) : null}
          </div>

          {showChevron ? (
            <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-400">
              {cardCountLabel ? <span>{cardCountLabel}</span> : null}
              <ChevronRight className="h-4 w-4" />
            </div>
          ) : isSyncing ? (
            <div
              className="flex max-w-[9rem] shrink-0 items-center gap-1.5 text-xs text-zinc-400"
              title={
                syncMessage
                  ? (formatSyncJobMessage(syncMessage, t) ?? undefined)
                  : undefined
              }
            >
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-hover" />
              <span className="truncate">
                {syncStatus === "pending" ? t("sets.waiting") : t("sets.loading")}
              </span>
            </div>
          ) : (
            <Button
              variant="soft"
              className="pointer-events-auto p-3"
              loading={loadingCards}
              disabled={!onLoadCards}
              aria-label={t("sets.loadCards")}
              icon={
                !loadingCards ? <Download className="h-5 w-5" /> : undefined
              }
              onClick={() => onLoadCards?.(id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
