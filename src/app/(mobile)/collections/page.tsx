"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CollectionListItem } from "@/components/collection-list-item";
import { CreateCollectionSheet } from "@/components/create-collection-sheet";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";

type CollectionSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  coverImageUrl: string | null;
  type: "set" | "custom";
  setId: string | null;
  setOfficialCode: string | null;
  ownedCount: number;
  totalCount: number;
  percent: number;
};

export default function CollectionListPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(apiUrl("/api/collections", locale));
    const payload = await response.json();
    if (response.ok) {
      setItems(payload.items ?? []);
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
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25"
        >
          <Plus className="h-4 w-4" />
          {t("collections.add")}
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">{t("collections.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-zinc-400">{t("collections.empty")}</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-4 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
          >
            {t("collections.createFirst")}
          </button>
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

      <CreateCollectionSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          void load();
        }}
      />
    </MobilePage>
  );
}
