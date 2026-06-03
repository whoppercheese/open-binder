import { Plus, CheckCircle2, CheckSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type LongPressIndicatorIcon = "plus" | "check" | "markOwned";

const INDICATOR_ICONS = {
  plus: Plus,
  check: CheckSquare2,
  markOwned: CheckCircle2,
} as const;

const INDICATOR_ICON_SIZES: Record<LongPressIndicatorIcon, string> = {
  plus: "h-[22%] w-[22%]",
  check: "h-[22%] w-[22%]",
  markOwned: "h-[30%] w-[30%]",
};

type LongPressIndicatorProps = {
  active: boolean;
  durationMs: number;
  compact?: boolean;
  icon?: LongPressIndicatorIcon;
};

export function LongPressIndicator({
  active,
  durationMs,
  compact = false,
  icon = "plus",
}: LongPressIndicatorProps) {
  if (!active) return null;

  const Icon = INDICATOR_ICONS[icon];

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
            className="text-accent-hover"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE}
            style={{
              animation: `long-press-progress ${durationMs}ms linear forwards`,
            }}
          />
        </svg>
        <Icon
          className={cn(
            "absolute inset-0 m-auto text-accent-text-soft",
            INDICATOR_ICON_SIZES[icon],
          )}
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
}
