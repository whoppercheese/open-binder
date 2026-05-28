import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
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

/** @deprecated Prefer `<PageHeader />` from `@/components/ui` for trailing/actions support. */
export function MobilePageHeader({
  title,
  subtitle,
  subtitleClassName,
  className,
}: MobilePageHeaderProps) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      subtitleClassName={subtitleClassName}
      className={className}
    />
  );
}
