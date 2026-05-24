import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MobilePageProps = {
  children: ReactNode;
  className?: string;
};

export function MobilePage({ children, className }: MobilePageProps) {
  return (
    <div className={cn("space-y-5 px-4 pt-6", className)}>{children}</div>
  );
}

type MobilePageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  className?: string;
};

export function MobilePageHeader({
  title,
  subtitle,
  subtitleClassName,
  className,
}: MobilePageHeaderProps) {
  return (
    <header className={className}>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle ? (
        <p className={cn("text-sm text-zinc-400", subtitleClassName)}>
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
