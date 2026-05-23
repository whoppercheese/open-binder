import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type LongPressIndicatorProps = {
  active: boolean;
  durationMs: number;
  compact?: boolean;
};

export function LongPressIndicator({
  active,
  durationMs,
  compact = false,
}: LongPressIndicatorProps) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/60"
      aria-hidden
    >
      <div className={cn("relative", compact ? "h-9 w-9" : "h-11 w-11")}>
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden
        >
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2.5"
          />
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-emerald-400"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE}
            style={{
              animation: `long-press-progress ${durationMs}ms linear forwards`,
            }}
          />
        </svg>
        <Plus
          className={cn(
            "absolute inset-0 m-auto text-emerald-200",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
          strokeWidth={2.5}
        />
      </div>
      {!compact ? (
        <p className="px-1 text-center text-[8px] leading-tight text-zinc-300">
          Loslassen · Abbrechen
        </p>
      ) : null}
    </div>
  );
}
