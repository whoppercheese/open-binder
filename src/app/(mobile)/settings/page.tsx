"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  formatJobStatusLabel,
  formatJobTypeLabel,
  formatSyncJobIssueSummary,
  getSyncJobIssues,
  isActiveSyncJob,
  type SyncJobProgress,
} from "@/lib/sync-job-display";
import { formatDate } from "@/lib/utils";

type SyncJob = {
  id: string;
  jobType: "catalog" | "set_cards" | "prices";
  setId?: string | null;
  status: string;
  message: string | null;
  progress: SyncJobProgress | null;
  createdAt: string;
  finishedAt: string | null;
};

export default function SettingsPage() {
  const [pricePreference, setPricePreference] = useState<"trend" | "low">("trend");
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

  async function triggerSync(type: "catalog" | "prices") {
    setSyncError(null);
    setLoading(type);
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setSyncError(
        (body.error as string) ??
          "Sync konnte nicht gestartet werden.",
      );
    }
    await load();
    setLoading(null);
  }

  return (
    <div className="space-y-6 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-sm text-zinc-400">Single-User · Self-Hosted</p>
      </header>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">Cardmarket Preis</h2>
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
              {value === "trend" ? "Trend" : "Low"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-medium">Daten-Sync</h2>
        <p className="text-sm text-zinc-400">
          Sets wöchentlich, Preise täglich. Kartendaten pro Set in der
          Set-Liste. Der Worker muss laufen.
        </p>
        {syncError ? (
          <p className="text-sm text-amber-400">{syncError}</p>
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
            Sets synchronisieren
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
            Preise jetzt synchronisieren
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Letzte Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch keine Sync-Jobs.</p>
        ) : (
          jobs.map((job) => {
            const issues = getSyncJobIssues(job.progress);
            const issueSummary = formatSyncJobIssueSummary(job.progress);

            return (
            <div
              key={job.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">
                  {formatJobTypeLabel(job.jobType, job.setId)}
                </span>
                <span
                  className={
                    job.status === "running"
                      ? "text-emerald-400"
                      : job.status === "failed"
                        ? "text-amber-400"
                        : issueSummary
                          ? "text-amber-400"
                          : "text-zinc-400"
                  }
                >
                  {formatJobStatusLabel(job.status, job.message)}
                </span>
              </div>
              {job.message ? (
                <p className="mt-1 text-zinc-500">{job.message}</p>
              ) : null}
              {issueSummary ? (
                <details className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-amber-200 [&::-webkit-details-marker]:hidden">
                    <span>
                      Probleme: {issueSummary}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  </summary>
                  <ul className="space-y-2 border-t border-amber-500/10 px-3 py-2">
                    {issues.map((issue, index) => (
                      <li key={`${issue.kind}-${issue.title}-${index}`}>
                        <p className="font-medium text-amber-100/90">
                          {issue.kind === "set"
                            ? "Set"
                            : issue.kind === "card"
                              ? "Karte"
                              : "Job"}
                          : {issue.title}
                        </p>
                        <p className="text-xs text-amber-100/60">{issue.detail}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                {formatDate(job.finishedAt ?? job.createdAt)}
              </p>
            </div>
            );
          })
        )}
      </section>

      <p className="text-xs leading-relaxed text-zinc-600">
        OpenBinder ist ein inoffizielles Fan-Tool. Pokémon und alle zugehörigen
        Marken sind Eigentum von Nintendo / Creatures Inc. / GAME FREAK inc.
        Kartendaten via TCGdex, Preise via Cardmarket (über TCGdex).
      </p>
    </div>
  );
}
