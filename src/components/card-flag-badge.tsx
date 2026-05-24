import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

type CardFlagBadgeProps = {
  size?: "sm" | "md";
  className?: string;
};

export function CardFlagBadge({ size = "md", className }: CardFlagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md bg-yellow-400 shadow-md shadow-black/40 ring-1 ring-black/25",
        size === "sm" ? "p-0.5" : "p-1",
        className,
      )}
      aria-label="Markiert"
    >
      <Flag
        className={cn("text-black", size === "sm" ? "h-4 w-4" : "h-5 w-5")}
        strokeWidth={2.5}
        aria-hidden
      />
    </span>
  );
}
