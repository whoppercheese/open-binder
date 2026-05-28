import { cn } from "@/lib/utils";

/** Shared layout for full-width row actions (nav links and sheet buttons). */
export const fullWidthRowBase =
  "flex w-full min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";

export function fullWidthRowNeutral(...extra: Parameters<typeof cn>) {
  return cn(
    fullWidthRowBase,
    "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
    ...extra,
  );
}

export function fullWidthRowEmeraldNav(...extra: Parameters<typeof cn>) {
  return cn(
    fullWidthRowBase,
    "justify-between border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
    ...extra,
  );
}

export function fullWidthRowEmeraldAction(...extra: Parameters<typeof cn>) {
  return cn(
    fullWidthRowBase,
    "justify-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
    ...extra,
  );
}
