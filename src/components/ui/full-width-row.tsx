import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const fullWidthRowVariants = cva(
  "flex w-full min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
  {
    variants: {
      variant: {
        neutral:
          "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
        emeraldNav:
          "justify-between border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
        emeraldAction:
          "justify-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type FullWidthRowOwnProps = VariantProps<typeof fullWidthRowVariants> & {
  children: ReactNode;
  className?: string;
  showChevron?: boolean;
  chevronClassName?: string;
};

type FullWidthRowAsButton = FullWidthRowOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof FullWidthRowOwnProps> & {
    href?: undefined;
  };

type FullWidthRowAsLink = FullWidthRowOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof FullWidthRowOwnProps> & {
    href: string;
  };

export type FullWidthRowProps = FullWidthRowAsButton | FullWidthRowAsLink;

type FullWidthRowVariant = NonNullable<
  VariantProps<typeof fullWidthRowVariants>["variant"]
>;

function RowChevron({
  variant = "neutral",
  className,
}: {
  variant?: FullWidthRowVariant;
  className?: string;
}) {
  return (
    <ChevronRight
      className={cn(
        "h-5 w-5 shrink-0",
        variant === "neutral" ? "text-zinc-400" : "text-emerald-200/80",
        className,
      )}
      aria-hidden
    />
  );
}

export function FullWidthRow({
  variant = "neutral",
  children,
  className,
  showChevron,
  chevronClassName,
  ...props
}: FullWidthRowProps) {
  const rowVariant: FullWidthRowVariant = variant ?? "neutral";
  const shouldShowChevron =
    showChevron ?? (rowVariant === "neutral" || rowVariant === "emeraldNav");

  const isLink = "href" in props && Boolean(props.href);
  const rowClassName = cn(
    fullWidthRowVariants({ variant: rowVariant }),
    isLink && rowVariant === "neutral" && "justify-between text-left",
    className,
  );

  const trailing = shouldShowChevron ? (
    <RowChevron variant={rowVariant} className={chevronClassName} />
  ) : null;

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={rowClassName} {...linkProps}>
        {children}
        {trailing}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as FullWidthRowAsButton;
  return (
    <button type="button" className={rowClassName} {...buttonProps}>
      {children}
      {trailing}
    </button>
  );
}

/** @deprecated Use `fullWidthRowVariants` via `<FullWidthRow />` instead. */
export const fullWidthRowBase =
  "flex w-full min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";

/** @deprecated Use `<FullWidthRow variant="neutral" />` instead. */
export function fullWidthRowNeutral(...extra: Parameters<typeof cn>) {
  return cn(fullWidthRowVariants({ variant: "neutral" }), ...extra);
}

/** @deprecated Use `<FullWidthRow variant="emeraldNav" />` instead. */
export function fullWidthRowEmeraldNav(...extra: Parameters<typeof cn>) {
  return cn(fullWidthRowVariants({ variant: "emeraldNav" }), ...extra);
}

/** @deprecated Use `<FullWidthRow variant="emeraldAction" />` instead. */
export function fullWidthRowEmeraldAction(...extra: Parameters<typeof cn>) {
  return cn(fullWidthRowVariants({ variant: "emeraldAction" }), ...extra);
}

type FullWidthNavLinkProps = {
  href: string;
  icon?: ElementType<{ className?: string }>;
  label: ReactNode;
  className?: string;
};

export function FullWidthNavLink({
  href,
  icon,
  label,
  className,
}: FullWidthNavLinkProps) {
  return (
    <FullWidthIconRow
      href={href}
      variant="emeraldNav"
      icon={icon}
      label={label}
      className={className}
    />
  );
}

type FullWidthIconRowOwnProps = VariantProps<typeof fullWidthRowVariants> & {
  icon?: ElementType<{ className?: string }>;
  label: ReactNode;
  className?: string;
  chevronClassName?: string;
  iconClassName?: string;
};

type FullWidthIconRowAsButton = FullWidthIconRowOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof FullWidthIconRowOwnProps> & {
    href?: undefined;
  };

type FullWidthIconRowAsLink = FullWidthIconRowOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof FullWidthIconRowOwnProps> & {
    href: string;
  };

export type FullWidthIconRowProps = FullWidthIconRowAsButton | FullWidthIconRowAsLink;

function FullWidthIconRowContent({
  icon: Icon,
  label,
  variant = "neutral",
  chevronClassName,
  iconClassName,
}: Pick<
  FullWidthIconRowOwnProps,
  "icon" | "label" | "chevronClassName" | "iconClassName"
> & {
  variant?: FullWidthRowVariant;
}) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
      <span aria-hidden />
      <span className="flex min-w-0 items-center justify-center gap-2">
        {Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              variant === "neutral" ? "text-zinc-400" : "text-emerald-200/80",
              iconClassName,
            )}
            aria-hidden
          />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <RowChevron
        variant={variant}
        className={cn("justify-self-end", chevronClassName)}
      />
    </div>
  );
}

export function FullWidthIconRow({
  icon,
  label,
  variant = "neutral",
  className,
  chevronClassName,
  iconClassName,
  ...props
}: FullWidthIconRowProps) {
  const rowVariant: FullWidthRowVariant = variant ?? "neutral";
  const content = (
    <FullWidthIconRowContent
      icon={icon}
      label={label}
      variant={rowVariant}
      chevronClassName={chevronClassName}
      iconClassName={iconClassName}
    />
  );
  const rowClassName = cn(fullWidthRowVariants({ variant: rowVariant }), className);

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={rowClassName} {...linkProps}>
        {content}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as FullWidthIconRowAsButton;
  return (
    <button type="button" className={rowClassName} {...buttonProps}>
      {content}
    </button>
  );
}

type FullWidthCountRowOwnProps = VariantProps<typeof fullWidthRowVariants> & {
  icon: ElementType<{ className?: string }>;
  label: ReactNode;
  count: number;
  className?: string;
  chevronClassName?: string;
  iconClassName?: string;
};

type FullWidthCountRowAsButton = FullWidthCountRowOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof FullWidthCountRowOwnProps> & {
    href?: undefined;
  };

type FullWidthCountRowAsLink = FullWidthCountRowOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof FullWidthCountRowOwnProps> & {
    href: string;
  };

export type FullWidthCountRowProps =
  | FullWidthCountRowAsButton
  | FullWidthCountRowAsLink;

function FullWidthCountRowContent({
  icon: Icon,
  label,
  count,
  variant = "neutral",
  chevronClassName,
  iconClassName,
}: Pick<
  FullWidthCountRowOwnProps,
  "icon" | "label" | "count" | "chevronClassName" | "iconClassName"
> & {
  variant?: FullWidthRowVariant;
}) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
      <span aria-hidden />
      <span className="flex min-w-0 items-center justify-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            variant === "neutral" ? "text-zinc-400" : "text-emerald-200/80",
            iconClassName,
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center justify-self-end gap-2 text-sm text-zinc-400">
        <span className="tabular-nums">{count}</span>
        <ChevronRight
          className={cn("h-5 w-5 shrink-0", chevronClassName)}
          aria-hidden
        />
      </span>
    </div>
  );
}

export function FullWidthCountRow({
  icon,
  label,
  count,
  variant = "neutral",
  className,
  chevronClassName,
  iconClassName,
  ...props
}: FullWidthCountRowProps) {
  const rowVariant: FullWidthRowVariant = variant ?? "neutral";
  const content = (
    <FullWidthCountRowContent
      icon={icon}
      label={label}
      count={count}
      variant={rowVariant}
      chevronClassName={chevronClassName}
      iconClassName={iconClassName}
    />
  );
  const rowClassName = cn(fullWidthRowVariants({ variant }), className);

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={rowClassName} {...linkProps}>
        {content}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as FullWidthCountRowAsButton;
  return (
    <button type="button" className={rowClassName} {...buttonProps}>
      {content}
    </button>
  );
}
