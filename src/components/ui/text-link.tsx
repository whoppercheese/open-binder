import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TextLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  children: ReactNode;
  showArrow?: boolean;
};

export function TextLink({
  children,
  className,
  showArrow = true,
  ...props
}: TextLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1 text-sm text-emerald-400 transition hover:text-emerald-300",
        className,
      )}
      {...props}
    >
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4 shrink-0" /> : null}
    </Link>
  );
}
