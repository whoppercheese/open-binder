"use client";

import { usePathname } from "next/navigation";
import { Home, Layers, Search, Settings, WalletCards } from "lucide-react";
import { NavTab } from "@/components/ui/nav-tab";
import { useTranslations } from "@/lib/i18n/context";
import { useOfflineNavigation } from "@/lib/offline/offline-navigation";
import { useOffline } from "@/lib/offline/offline-provider";

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
          const isCollectionsNav = href === COLLECTIONS_HREF;
          const active = isOfflineView
            ? isCollectionsNav
            : href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          const disabled = isOfflineView && !isCollectionsNav;

          return (
            <NavTab
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={active}
              disabled={disabled}
              disabledTitle={t("offline.navDisabled")}
              onClick={
                isOfflineView && isCollectionsNav
                  ? (event) => {
                      event.preventDefault();
                      if (screen.kind === "detail") {
                        openList();
                      }
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </nav>
  );
}
