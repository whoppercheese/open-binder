"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CollectionCover } from "@/components/collection-cover";
import { ProgressBar } from "@/components/progress-bar";
import { useTranslations } from "@/lib/i18n/context";
import { useOfflineNavigation } from "@/lib/offline/offline-navigation";
import { useOffline } from "@/lib/offline/offline-provider";
type CollectionListItemProps = {
  id: string;
  name: string;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  setId?: string | null;
  setOfficialCode?: string | null;
  owned: number;
  total: number;
  percent: number;
  type?: "set" | "custom";
};

export function CollectionListItem({
  id,
  name,
  imageUrl,
  coverImageUrl,
  setId,
  setOfficialCode,
  owned,
  total,
  percent,
}: CollectionListItemProps) {
  const t = useTranslations();
  const { isOfflineView } = useOffline();
  const { openCollection } = useOfflineNavigation();
  const showProgress = total > 0;
  const href = `/collections/${id}`;
  const linkClassName =
    "absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-hover/50";

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
      {isOfflineView ? (
        <button
          type="button"
          onClick={() => openCollection(id)}
          className={linkClassName}
          aria-label={t("collections.openCollection", { name })}
        />
      ) : (
        <Link
          href={href}
          prefetch={false}
          className={linkClassName}
          aria-label={t("collections.openCollection", { name })}
        />
      )}

      <div className="pointer-events-none relative z-[1] p-4">
        <div className={`flex items-center gap-3 ${showProgress ? "mb-3" : ""}`}>
          <CollectionCover
            name={name}
            imageUrl={imageUrl}
            coverImageUrl={coverImageUrl}
            setId={setId}
            setOfficialCode={setOfficialCode}
            className="h-12 w-12 shrink-0 text-sm"
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{name}</h3>
            {showProgress ? (
              <p className="text-xs text-zinc-500">
                {t("collections.progressSummary", { owned, total })}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">{t("collections.emptyProgress")}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-400">
            {showProgress ? (
              <span>
                {owned}/{total}
              </span>
            ) : null}
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {showProgress ? (
          <>
            <ProgressBar value={percent} />
            <p className="mt-1 text-xs text-zinc-500">
              {t("sets.percentComplete", { percent })}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
