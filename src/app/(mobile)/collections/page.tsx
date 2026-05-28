"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { CollectionListItem } from "@/components/collection-list-item";
import { CreateCollectionSheet } from "@/components/create-collection-sheet";
import { MobilePage } from "@/components/mobile-page";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveFilterBanner } from "@/components/ui/active-filter-banner";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        title={t("collections.title")}
        subtitle={
          setFilterId
            ? t("collections.subtitleFilteredBySet")
            : t("collections.subtitle")
        }
        trailing={
          !isOfflineView ? (
            <Button
              variant="pill"
              size="compact"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              {t("collections.add")}
            </Button>
          ) : null
        }
      />
      {setFilterId ? (
        <ActiveFilterBanner
          label={t("collections.filteredBySet")}
          value={setFilterLabel ?? t("collections.filterBySetActive")}
          onClear={clearSetFilter}
          clearLabel={t("collections.clearSetFilter")}
        />
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
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              {t("collections.createFirst")}
            </Button>
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
