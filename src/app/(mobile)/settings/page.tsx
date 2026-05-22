"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

type SyncJob = {
  id: string;
  jobType: "catalog" | "prices";
  status: string;
  message: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export default function SettingsPage() {
  const [pricePreference, setPricePreference] = useState<"trend" | "low">("trend");
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

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

  async function savePreference(value: "trend" | "low") {
    setPricePreference(value);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePreference: value }),
    });
  }

  async function triggerSync(type: "catalog" | "prices") {
    setLoading(type);
    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
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
          Katalog wöchentlich, Preise täglich. Der Worker muss laufen.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => triggerSync("catalog")}
            disabled={loading != null}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white"
          >
            {loading === "catalog" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Katalog jetzt synchronisieren
          </button>
          <button
            type="button"
            onClick={() => triggerSync("prices")}
            disabled={loading != null}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white"
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
          jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium capitalize text-white">
                  {job.jobType}
                </span>
                <span className="text-zinc-400">{job.status}</span>
              </div>
              {job.message ? (
                <p className="mt-1 text-zinc-500">{job.message}</p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                {formatDate(job.finishedAt ?? job.createdAt)}
              </p>
            </div>
          ))
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
