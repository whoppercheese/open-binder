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
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60 px-1"
      aria-hidden
    >
      <div
        className={cn(
          "relative aspect-square max-h-full",
          compact ? "w-[92%]" : "w-[88%]",
        )}
      >
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
          className="absolute inset-0 m-auto h-[22%] w-[22%] text-emerald-200"
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
}
