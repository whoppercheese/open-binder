import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardFrameProps = ComponentPropsWithoutRef<"div"> & {
  innerClassName?: string;
  children: ReactNode;
};

export function CardFrame({
  className,
  innerClassName,
  children,
  ...props
}: CardFrameProps) {
  return (
    <div className={cn("card-frame", className)} {...props}>
      <div
        className={cn(
          "rounded-card relative size-full min-h-0 min-w-0 overflow-hidden",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
