"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Ellipsis, X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center transition",
  {
    variants: {
      variant: {
        close:
          "rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white",
        menu: "-mr-1 h-10 w-10 rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-300 active:bg-white/10",
        toolbar:
          "h-10 w-10 rounded-xl text-accent-text-soft hover:bg-accent/15",
        subtle:
          "h-10 w-10 rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white",
        clear:
          "rounded-lg p-2 text-accent-text-soft hover:bg-accent/10",
      },
    },
    defaultVariants: {
      variant: "close",
    },
  },
);

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(iconButtonVariants({ variant }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

type SheetCloseButtonProps = Omit<IconButtonProps, "children" | "variant">;

export function SheetCloseButton(props: SheetCloseButtonProps) {
  return (
    <IconButton variant="close" {...props}>
      <X className="h-5 w-5" />
    </IconButton>
  );
}

type IconMenuButtonProps = Omit<IconButtonProps, "children"> & {
  variant?: "menu" | "toolbar";
};

export function IconMenuButton({
  variant = "menu",
  ...props
}: IconMenuButtonProps) {
  return (
    <IconButton variant={variant} aria-haspopup="menu" {...props}>
      <Ellipsis className="h-5 w-5" strokeWidth={variant === "menu" ? 2 : undefined} />
    </IconButton>
  );
}
