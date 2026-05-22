import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/progress-bar";
import { SetImage } from "@/components/set-image";

type SetListItemProps = {
  id: string;
  nameDe: string;
  officialCode?: string | null;
  owned: number;
  total: number;
  percent: number;
};

export function SetListItem({
  id,
  nameDe,
  officialCode,
  owned,
  total,
  percent,
}: SetListItemProps) {
  return (
    <Link
      href={`/sets/${id}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
    >
      <div className="mb-3 flex items-start gap-3">
        <SetImage setId={id} alt={nameDe} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-white">{nameDe}</h3>
              {officialCode ? (
                <p className="text-xs text-zinc-500">{officialCode}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-400">
              <span>
                {owned}/{total}
              </span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
      <ProgressBar value={percent} />
      <p className="mt-1 text-xs text-zinc-500">{percent}% komplett</p>
    </Link>
  );
}
