import { resolveTranslation, type TranslateFn } from "@/lib/i18n/messages";

export type SyncJobMessagePayload = {
  k: string;
  p?: Record<string, string | number>;
};

export const WORKER_RESTART_MESSAGE_KEY = "workerRestart";

/** @deprecated Legacy German string still present in older job rows. */
export const WORKER_RESTART_MESSAGE =
  "Unterbrochen durch Worker-Neustart";

export function encodeSyncJobMessage(
  key: string,
  params?: Record<string, string | number>,
): string {
  const payload: SyncJobMessagePayload = params ? { k: key, p: params } : { k: key };
  return JSON.stringify(payload);
}

function parseSyncJobMessage(raw: string): SyncJobMessagePayload | null {
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as SyncJobMessagePayload;
    if (typeof parsed.k === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

const LEGACY_MESSAGE_PATTERNS: Array<{
  pattern: RegExp;
  key: string;
  mapParams?: (match: RegExpMatchArray) => Record<string, string | number>;
}> = [
  { pattern: /^Starte Sets-Sync…$/, key: "catalogStarting" },
  {
    pattern: /^Sets-Sync für (\d+) Set\(s\)…$/,
    key: "catalogForSetsCount",
    mapParams: (m) => ({ count: Number(m[1]) }),
  },
  {
    pattern: /^Set (\d+)\/(\d+): (.+)$/,
    key: "catalogSetProgress",
    mapParams: (m) => ({
      current: Number(m[1]),
      total: Number(m[2]),
      name: m[3],
    }),
  },
  {
    pattern: /^Sets-Sync abgeschlossen \((\d+) Sets\)\.$/,
    key: "catalogCompleted",
    mapParams: (m) => ({ count: Number(m[1]) }),
  },
  {
    pattern: /^Starte Karten-Sync für (.+)…$/,
    key: "setCardsStarting",
    mapParams: (m) => ({ setName: m[1] }),
  },
  {
    pattern: /^Karte (\d+)\/(\d+): (.+)$/,
    key: "setCardsProgress",
    mapParams: (m) => ({
      current: Number(m[1]),
      total: Number(m[2]),
      name: m[3],
    }),
  },
  {
    pattern: /^Karten-Sync abgeschlossen \((.+), (\d+) Karte\(n\) übersprungen\)\.$/,
    key: "setCardsCompletedWithSkips",
    mapParams: (m) => ({ setName: m[1], skipped: Number(m[2]) }),
  },
  {
    pattern: /^Karten-Sync abgeschlossen \((.+)\)\.$/,
    key: "setCardsCompleted",
    mapParams: (m) => ({ setName: m[1] }),
  },
  {
    pattern: /^Wöchentlicher Karten-Refresh für (.+)$/,
    key: "weeklySetCardsRefresh",
    mapParams: (m) => ({ setName: m[1] }),
  },
  { pattern: /^Starte Preis-Sync…$/, key: "pricesStarting" },
  {
    pattern: /^Cardmarket Katalog: (\d+)\/(\d+)$/,
    key: "cardmarketCatalogProgress",
    mapParams: (m) => ({ current: Number(m[1]), total: Number(m[2]) }),
  },
  {
    pattern: /^Preise aktualisiert: (\d+)\/(\d+)$/,
    key: "pricesUpdatedProgress",
    mapParams: (m) => ({ updated: Number(m[1]), total: Number(m[2]) }),
  },
  {
    pattern: /^Preis-Sync abgeschlossen \(keine Karten in der Sammlung\)\.$/,
    key: "pricesCompletedEmpty",
  },
  {
    pattern: /^Preis-Sync abgeschlossen \((\d+) Karten\)\.$/,
    key: "pricesCompleted",
    mapParams: (m) => ({ count: Number(m[1]) }),
  },
  { pattern: /^Unterbrochen durch Worker-Neustart$/, key: WORKER_RESTART_MESSAGE_KEY },
];

function matchLegacyMessage(raw: string): SyncJobMessagePayload | null {
  for (const entry of LEGACY_MESSAGE_PATTERNS) {
    const match = raw.match(entry.pattern);
    if (match) {
      return {
        k: entry.key,
        p: entry.mapParams?.(match),
      };
    }
  }
  return null;
}

export function isWorkerRestartMessage(message: string | null): boolean {
  if (!message) return false;
  if (message === WORKER_RESTART_MESSAGE) return true;
  const parsed = parseSyncJobMessage(message) ?? matchLegacyMessage(message);
  return parsed?.k === WORKER_RESTART_MESSAGE_KEY;
}

export function formatSyncJobMessage(
  raw: string | null | undefined,
  t: TranslateFn,
): string | null {
  if (!raw) return null;

  const payload = parseSyncJobMessage(raw) ?? matchLegacyMessage(raw);
  if (payload) {
    const key = `sync.messages.${payload.k}`;
    const translated = resolveTranslation(t, key, payload.p);
    if (translated !== key) {
      return translated;
    }
  }

  return raw;
}
