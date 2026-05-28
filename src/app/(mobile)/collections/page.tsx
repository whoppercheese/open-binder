"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { CollectionListItem } from "@/components/collection-list-item";
import { CreateCollectionSheet } from "@/components/create-collection-sheet";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { useOffline } from "@/lib/offline/offline-provider";
import { loadCollections } from "@/lib/offline/read";
import type { CollectionSummary } from "@/lib/offline/types";

export default function CollectionListPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { isOfflineView, hasCachedData, cacheReady } = useOffline();
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const setFilterId = (searchParams.get("setId") ?? "").trim();

  const filteredItems = useMemo(() => {
    if (!setFilterId) {
      return items;
    }
    return items.filter((item) => item.type === "set" && item.setId === setFilterId);
  }, [items, setFilterId]);

  const setFilterLabel = useMemo(() => {
    if (!setFilterId) {
      return null;
    }
    const matched = items.find(
      (item) =>
        item.type === "set" && item.setId === setFilterId && item.setOfficialCode,
    );
    return matched?.setOfficialCode ?? setFilterId;
  }, [items, setFilterId]);

  const clearSetFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("setId");
    const query = params.toString();
    router.replace(query ? `/collections?${query}` : "/collections", {
      scroll: false,
    });
  }, [router, searchParams]);

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
          subtitle={
            setFilterId
              ? t("collections.subtitleFilteredBySet")
              : t("collections.subtitle")
          }
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
      {setFilterId ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-emerald-300/80">
              {t("collections.filteredBySet")}
            </p>
            <p className="truncate font-medium">
              {setFilterLabel ?? t("collections.filterBySetActive")}
            </p>
          </div>
          <button
            type="button"
            onClick={clearSetFilter}
            className="shrink-0 rounded-lg p-2 text-emerald-200 hover:bg-emerald-500/10"
            aria-label={t("collections.clearSetFilter")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">{t("collections.loading")}</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-zinc-400">
            {setFilterId
              ? t("collections.emptyFilteredBySet")
              : isOfflineView && cacheReady && !hasCachedData
                ? t("offline.noData")
                : t("collections.empty")}
          </p>
          {!isOfflineView && !setFilterId ? (
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
          {filteredItems.map((item) => (
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
