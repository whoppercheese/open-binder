"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Search, Settings, WalletCards } from "lucide-react";
import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const items = [
    { href: "/", label: t("nav.dashboard"), icon: Home },
    { href: "/sets", label: t("nav.sets"), icon: Layers },
    { href: "/search", label: t("nav.search"), icon: Search },
    { href: "/collection", label: t("nav.collection"), icon: WalletCards },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <nav className="shrink-0 border-t border-white/10 bg-[#10131a]/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                active
                  ? "text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
