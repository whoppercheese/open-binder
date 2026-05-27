"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CollectionListItem } from "@/components/collection-list-item";
import { CreateCollectionSheet } from "@/components/create-collection-sheet";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { useOffline } from "@/lib/offline/offline-provider";
import { loadCollections } from "@/lib/offline/read";
import type { CollectionSummary } from "@/lib/offline/types";

export default function CollectionListPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const { isOfflineView, hasCachedData, cacheReady } = useOffline();
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await loadCollections(locale);
    if (result.ok) {
      setItems(result.data);
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MobilePage>
      <header className="flex items-start justify-between gap-3">
        <MobilePageHeader
          title={t("collections.title")}
          subtitle={t("collections.subtitle")}
        />
        {!isOfflineView ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-4 w-4" />
            {t("collections.add")}
          </button>
        ) : null}
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">{t("collections.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-zinc-400">
            {isOfflineView && cacheReady && !hasCachedData
              ? t("offline.noData")
              : t("collections.empty")}
          </p>
          {!isOfflineView ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
            >
              {t("collections.createFirst")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <CollectionListItem
              key={item.id}
              id={item.id}
              name={item.name}
              imageUrl={item.imageUrl}
              coverImageUrl={item.coverImageUrl}
              setId={item.setId}
              setOfficialCode={item.setOfficialCode}
              owned={item.ownedCount}
              total={item.totalCount}
              percent={item.percent}
              type={item.type}
            />
          ))}
        </div>
      )}

      {!isOfflineView ? (
        <CreateCollectionSheet
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      ) : null}
    </MobilePage>
  );
}
