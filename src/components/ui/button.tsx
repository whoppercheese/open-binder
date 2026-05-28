"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "rounded-2xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400",
        secondary:
          "rounded-xl bg-white/10 text-sm font-medium text-white",
        soft: "rounded-xl bg-emerald-500/15 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25",
        pill: "rounded-full bg-emerald-500/15 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25",
        outline:
          "rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20",
        cancel:
          "rounded-2xl border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/5",
        destructive:
          "rounded-2xl border border-red-400/30 text-sm font-semibold text-red-400 hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300",
        destructiveSoft:
          "rounded-2xl border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-300 hover:bg-red-500/20",
        dashed:
          "rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-sm font-medium text-zinc-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200",
      },
      size: {
        md: "px-4 py-3",
        sm: "px-4 py-2",
        compact: "px-3 py-1.5",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    icon?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      icon,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size, fullWidth }),
          loading && variant === "primary" && "opacity-60",
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    icon?: ReactNode;
  };

export function ButtonLink({
  className,
  variant,
  size,
  fullWidth,
  icon,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}

export { buttonVariants };
