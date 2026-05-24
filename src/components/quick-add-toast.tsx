import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickAddToastData =
  | {
      kind: "success";
      number: string;
      name: string;
      conditionLabel: string;
    }
  | { kind: "error"; message: string };

type QuickAddToastProps = {
  data: QuickAddToastData;
  className?: string;
};

export function QuickAddToast({ data, className }: QuickAddToastProps) {
  if (data.kind === "error") {
    return (
      <div
        className={cn(
          "pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-xl border border-red-400/40 bg-red-950/95 px-4 py-2.5 text-center text-sm text-red-50 shadow-lg",
          className,
        )}
      >
        {data.message}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-2xl border border-emerald-400/30 bg-[#0f1612]/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm leading-snug">
        <Check
          className="h-4 w-4 shrink-0 text-emerald-400"
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="inline-flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
          <span className="shrink-0 font-semibold tabular-nums text-emerald-300/90">
            #{data.number}
          </span>
          <span className="min-w-0 truncate font-medium text-white">
            {data.name}
          </span>
          <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-200">
            {data.conditionLabel}
          </span>
          <span className="shrink-0 text-emerald-400/75">hinzugefügt</span>
        </span>
      </p>
    </div>
  );
}
