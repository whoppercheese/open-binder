"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Search, Settings, WalletCards } from "lucide-react";
import { useTranslations } from "@/lib/i18n/context";
import { useOfflineNavigation } from "@/lib/offline/offline-navigation";
import { useOffline } from "@/lib/offline/offline-provider";
import { cn } from "@/lib/utils";

const COLLECTIONS_HREF = "/collections";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isOfflineView } = useOffline();
  const { screen, openList } = useOfflineNavigation();

  const items = [
    { href: "/", label: t("nav.dashboard"), icon: Home },
    { href: "/sets", label: t("nav.sets"), icon: Layers },
    { href: COLLECTIONS_HREF, label: t("nav.collection"), icon: WalletCards },
    { href: "/search", label: t("nav.search"), icon: Search },
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
          const isCollectionsNav = href === COLLECTIONS_HREF;
          const disabled = isOfflineView && !isCollectionsNav;

          if (disabled) {
            return (
              <span
                key={href}
                title={t("offline.navDisabled")}
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-zinc-600"
              >
                <Icon className="h-5 w-5" />
                {label}
              </span>
            );
          }

          const className = cn(
            "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
            active
              ? "text-emerald-400"
              : "text-zinc-400 hover:text-zinc-200",
          );

          if (isOfflineView && isCollectionsNav) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => {
                  if (screen.kind === "detail") {
                    openList();
                  }
                }}
                className={className}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          }

          return (
            <Link key={href} href={href} prefetch={false} className={className}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
