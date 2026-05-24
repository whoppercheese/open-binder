"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
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
import { UI_LOCALES, type UiLocale } from "@/lib/i18n/locale";
import {
  CARD_CONDITIONS,
  formatDate,
  type CardCondition,
} from "@/lib/utils";

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

function conditionLabel(condition: CardCondition, t: ReturnType<typeof useTranslations>) {
  const keys: Record<CardCondition, string> = {
    mint: "common.conditionMint",
    nm: "common.conditionNm",
    lp: "common.conditionLp",
    mp: "common.conditionMp",
    hp: "common.conditionHp",
  };
  return t(keys[condition]);
}

export default function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [pricePreference, setPricePreference] = useState<"trend" | "low">("trend");
  const [defaultCondition, setDefaultCondition] = useState<CardCondition>("nm");
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [settingsRes, syncRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/sync"),
    ]);
    const settings = await settingsRes.json();
    const sync = await syncRes.json();
    setPricePreference(settings.pricePreference ?? "trend");
    setDefaultCondition(settings.defaultCondition ?? "nm");
    setJobs(sync.jobs ?? []);
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
  const pricesActive = jobs.some(
    (job) => job.jobType === "prices" && isActiveSyncJob(job.status),
  );

  async function savePreference(value: "trend" | "low") {
    setPricePreference(value);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePreference: value }),
    });
  }

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

  async function triggerSync(type: "catalog" | "prices") {
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

  return (
    <div className="space-y-6 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-zinc-400">{t("settings.subtitle")}</p>
      </header>

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
        <h2 className="font-medium">{t("settings.cardmarketPrice")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["trend", "low"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => savePreference(value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                pricePreference === value
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-zinc-300"
              }`}
            >
              {value === "trend" ? t("settings.priceTrend") : t("settings.priceLow")}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("settings.defaultCondition")}</h2>
        <p className="text-sm text-zinc-400">{t("settings.defaultConditionHelp")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CARD_CONDITIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => void saveDefaultCondition(value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                defaultCondition === value
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-zinc-300"
              }`}
            >
              {conditionLabel(value, t)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">{t("settings.dataSync")}</h2>
        <p className="text-sm text-zinc-400">{t("settings.dataSyncHelp")}</p>
        {syncError ? (
          <p className="text-sm text-red-400">{syncError}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => triggerSync("catalog")}
            disabled={loading != null || catalogActive}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading === "catalog" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("settings.syncSets")}
          </button>
          <button
            type="button"
            onClick={() => triggerSync("prices")}
            disabled={loading != null || pricesActive}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading === "prices" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("settings.syncPricesNow")}
          </button>
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
    </div>
  );
}
