import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Content before the title block (e.g. collection cover). */
  leading?: ReactNode;
  /** Top-right control (menu, add button, …). Aligned to the title row, not the subtitle. */
  trailing?: ReactNode;
  /** Optional blocks below the title row (errors, sync banners, action rows). */
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/**
 * Page title + subtitle with consistent spacing to following page content.
 * Use inside `MobilePage` (or another container with vertical `space-y-*`).
 */
export function PageHeader({
  title,
  subtitle,
  leading,
  trailing,
  children,
  className,
  titleClassName,
  subtitleClassName,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      <div className="flex items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h1
            className={cn(
              "text-2xl font-bold leading-tight text-white",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <div
              className={cn(
                "space-y-1 text-sm leading-snug text-zinc-400",
                subtitleClassName,
              )}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center self-start">{trailing}</div>
        ) : null}
      </div>
      {children ? <div className="space-y-2">{children}</div> : null}
    </header>
  );
}
