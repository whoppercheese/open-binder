"use client";

import { useOffline } from "@/lib/offline/offline-provider";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { formatDate } from "@/lib/utils";

export function OfflineBanner() {
  const { isOfflineView, lastSyncedAt } = useOffline();
  const { locale } = useLocale();
  const t = useTranslations();

  if (!isOfflineView) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
      {lastSyncedAt
        ? t("offline.bannerWithDate", {
            date: formatDate(lastSyncedAt, locale),
          })
        : t("offline.banner")}
    </div>
  );
}
