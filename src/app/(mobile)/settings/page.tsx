"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatJobStatusLabel,
  formatJobTypeLabel,
  formatSyncJobIssueSummary,
  formatSyncJobMessage,
  getSyncJobIssues,
  isActiveSyncJob,
  type SyncJobProgress,
} from "@/lib/sync-job-display";
import { useLocale, useTranslations } from "@/lib/i18n/context";
import { ConditionBadgeButton } from "@/components/condition-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MobilePage, MobilePageHeader } from "@/components/mobile-page";
import { clearAllOfflineData, getOfflineCacheStats } from "@/lib/offline/db";
import { useOffline } from "@/lib/offline/offline-provider";
import { UI_LOCALES, type UiLocale } from "@/lib/i18n/locale";
import { getCardmarketConditionHelpUrl } from "@/lib/cardmarket";
import {
  CARD_CONDITIONS,
  formatDate,
  type CardCondition,
} from "@/lib/utils";

const BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP;

type SyncJob = {
  id: string;
  jobType: "catalog" | "set_cards" | "prices";
  setId?: string | null;
  setName?: string | null;
  status: string;
  message: string | null;
  progress: SyncJobProgress | null;
  createdAt: string;
  finishedAt: string | null;
};


export default function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [defaultCondition, setDefaultCondition] = useState<CardCondition>("nm");
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState({
    collectionCount: 0,
    lastFullSyncAt: null as string | null,
  });
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const { syncing } = useOffline();

  const load = useCallback(async () => {
    const [settingsRes, syncRes, offlineStats] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/sync"),
      getOfflineCacheStats(),
    ]);
    const settings = await settingsRes.json();
    const sync = await syncRes.json();
    setDefaultCondition(settings.defaultCondition ?? "nm");
    setJobs(sync.jobs ?? []);
    setCacheStats(offlineStats);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await load();
      if (cancelled) return;
    })();

    const timer = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  const catalogActive = jobs.some(
    (job) => job.jobType === "catalog" && isActiveSyncJob(job.status),
  );

  async function saveDefaultCondition(value: CardCondition) {
    setDefaultCondition(value);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultCondition: value }),
    });
  }

  async function saveLanguage(value: UiLocale) {
    setLocale(value);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiLanguage: value }),
    });
  }

  async function triggerSync(type: "catalog") {
    setSyncError(null);
    setLoading(type);
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) {
      setSyncError(t("errors.syncStartFailed"));
    }
    await load();
    setLoading(null);
  }

  async function handleClearCache() {
    setClearingCache(true);
    try {
      await clearAllOfflineData();
      await load();
    } finally {
      setClearingCache(false);
      setConfirmClearOpen(false);
    }
  }

  return (
    <MobilePage>
      <MobilePageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("settings.language")}</h2>
        <p className="text-sm text-zinc-400">{t("settings.languageHelp")}</p>
        <div className="grid grid-cols-2 gap-2">
          {UI_LOCALES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => void saveLanguage(value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                locale === value
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-zinc-300"
              }`}
            >
              {value === "en" ? t("settings.languageEn") : t("settings.languageDe")}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("settings.defaultCondition")}</h2>
        <p className="text-sm text-zinc-400">{t("settings.defaultConditionHelp")}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {CARD_CONDITIONS.map((value) => (
            <ConditionBadgeButton
              key={value}
              condition={value}
              selected={defaultCondition === value}
              onClick={() => void saveDefaultCondition(value)}
            />
          ))}
        </div>
        <a
          href={getCardmarketConditionHelpUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-emerald-400 hover:underline"
        >
          {t("settings.defaultConditionCardmarketHelp")}
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </a>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("offline.cacheTitle")}</h2>
        <p className="text-sm text-zinc-400">{t("offline.cacheHelp")}</p>
        <div className="space-y-1 text-sm text-zinc-300">
          <p>
            {t("offline.cacheCollections", {
              count: cacheStats.collectionCount,
            })}
          </p>
          <p className="text-zinc-500">
            {cacheStats.lastFullSyncAt
              ? t("offline.cacheLastSynced", {
                  date: formatDate(cacheStats.lastFullSyncAt, locale),
                })
              : t("offline.cacheNeverSynced")}
            {syncing ? ` · ${t("collections.loading")}` : null}
          </p>
        </div>
        <Button
          variant="secondary"
          fullWidth
          loading={clearingCache}
          disabled={cacheStats.collectionCount === 0}
          onClick={() => setConfirmClearOpen(true)}
        >
          {clearingCache ? t("offline.cacheClearing") : t("offline.cacheClear")}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("settings.dataSync")}</h2>
        <p className="text-sm text-zinc-400">{t("settings.dataSyncHelp")}</p>
        {syncError ? (
          <p className="text-sm text-red-400">{syncError}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="secondary"
            fullWidth
            loading={loading === "catalog"}
            disabled={loading != null || catalogActive}
            icon={
              loading !== "catalog" ? <RefreshCw className="h-4 w-4" /> : undefined
            }
            onClick={() => triggerSync("catalog")}
          >
            {t("settings.syncSets")}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t("settings.recentJobs")}</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("settings.noSyncJobs")}</p>
        ) : (
          jobs.map((job) => {
            const issues = getSyncJobIssues(job.progress, t);
            const issueSummary = formatSyncJobIssueSummary(job.progress, t);

            return (
            <div
              key={job.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">
                  {formatJobTypeLabel(job.jobType, job.setId, t, job.setName)}
                </span>
                <span
                  className={
                    job.status === "running"
                      ? "text-emerald-400"
                      : job.status === "failed"
                        ? "text-red-400"
                        : issueSummary
                          ? "text-yellow-400"
                          : "text-zinc-400"
                  }
                >
                  {formatJobStatusLabel(job.status, job.message, t)}
                </span>
              </div>
              {job.message ? (
                <p className="mt-1 text-zinc-500">
                  {formatSyncJobMessage(job.message, t)}
                </p>
              ) : null}
              {issueSummary ? (
                <details className="mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-yellow-200 [&::-webkit-details-marker]:hidden">
                    <span>
                      {t("settings.issuesSummary", { summary: issueSummary })}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  </summary>
                  <ul className="space-y-2 border-t border-yellow-500/10 px-3 py-2">
                    {issues.map((issue, index) => (
                      <li key={`${issue.kind}-${issue.title}-${index}`}>
                        <p className="font-medium text-yellow-100/90">
                          {issue.kind === "set"
                            ? t("settings.issueKindSet")
                            : issue.kind === "card"
                              ? t("settings.issueKindCard")
                              : t("settings.issueKindJob")}
                          : {issue.title}
                        </p>
                        <p className="text-xs text-yellow-100/60">{issue.detail}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                {formatDate(job.finishedAt ?? job.createdAt, locale)}
              </p>
            </div>
            );
          })
        )}
      </section>

      <p className="text-xs leading-relaxed text-zinc-600">
        {t("settings.disclaimer")}
      </p>

      {BUILD_TIMESTAMP ? (
        <p className="text-xs text-zinc-600">
          {t("settings.buildTimestamp", {
            date: formatDate(BUILD_TIMESTAMP, locale),
          })}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmClearOpen}
        title={t("offline.cacheClear")}
        message={t("offline.cacheClearConfirm")}
        loading={clearingCache}
        onConfirm={() => void handleClearCache()}
        onCancel={() => {
          if (!clearingCache) setConfirmClearOpen(false);
        }}
      />
    </MobilePage>
  );
}
