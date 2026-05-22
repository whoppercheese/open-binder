import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/progress-bar";

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
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-white">{nameDe}</h3>
          {officialCode ? (
            <p className="text-xs text-zinc-500">{officialCode}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>
            {owned}/{total}
          </span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
      <ProgressBar value={percent} />
      <p className="mt-1 text-xs text-zinc-500">{percent}% komplett</p>
    </Link>
  );
}
