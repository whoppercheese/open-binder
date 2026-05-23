import Link from "next/link";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/progress-bar";
import { SetImage } from "@/components/set-image";

type SetListItemProps = {
  id: string;
  nameDe: string;
  officialCode?: string | null;
  cardsSynced: boolean;
  syncStatus?: "idle" | "pending" | "running";
  syncMessage?: string | null;
  owned?: number;
  total?: number;
  percent?: number;
  onLoadCards?: (setId: string) => void;
  loadingCards?: boolean;
};

export function SetListItem({
  id,
  nameDe,
  officialCode,
  cardsSynced,
  syncStatus = "idle",
  syncMessage,
  owned = 0,
  total = 0,
  percent = 0,
  onLoadCards,
  loadingCards = false,
}: SetListItemProps) {
  const isSyncing = syncStatus === "pending" || syncStatus === "running";
  const showProgress = cardsSynced && !isSyncing;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
      <Link
        href={`/sets/${id}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        aria-label={`${nameDe} öffnen`}
      />

      <div className="pointer-events-none relative z-[1] p-4">
        <div className={`flex items-center gap-3 ${showProgress ? "mb-3" : ""}`}>
          <SetImage setId={id} alt={nameDe} className="h-12 w-12 shrink-0" />

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{nameDe}</h3>
            {officialCode ? (
              <p className="text-xs text-zinc-500">{officialCode}</p>
            ) : null}
          </div>

          {showProgress ? (
            <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-400">
              <span>
                {owned}/{total}
              </span>
              <ChevronRight className="h-4 w-4" />
            </div>
          ) : isSyncing ? (
            <div
              className="flex max-w-[9rem] shrink-0 items-center gap-1.5 text-xs text-zinc-400"
              title={syncMessage ?? undefined}
            >
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-400" />
              <span className="truncate">
                {syncStatus === "pending" ? "Wartend…" : "Lädt…"}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onLoadCards?.(id)}
              disabled={loadingCards || !onLoadCards}
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {loadingCards ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Karten laden
            </button>
          )}
        </div>

        {showProgress ? (
          <>
            <ProgressBar value={percent} />
            <p className="mt-1 text-xs text-zinc-500">{percent}% komplett</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
