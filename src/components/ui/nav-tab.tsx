"use client";

import Link from "next/link";
import { type ComponentPropsWithoutRef, type ElementType } from "react";
import { cn } from "@/lib/utils";

type NavTabProps = {
  href: string;
  label: string;
  icon: ElementType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  onClick?: ComponentPropsWithoutRef<typeof Link>["onClick"];
};

export function NavTab({
  href,
  label,
  icon: Icon,
  active = false,
  disabled = false,
  disabledTitle,
  onClick,
}: NavTabProps) {
  const className = cn(
    "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
    disabled
      ? "text-zinc-600"
      : active
        ? "text-emerald-400"
        : "text-zinc-400 hover:text-zinc-200",
  );

  if (disabled) {
    return (
      <span key={href} title={disabledTitle} className={className}>
        <Icon className="h-5 w-5" />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
