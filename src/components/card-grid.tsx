import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardGridProps = {
  children: ReactNode;
  className?: string;
};

export function CardGrid({ children, className }: CardGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-3 sm:grid-cols-4", className)}>
      {children}
    </div>
  );
}
