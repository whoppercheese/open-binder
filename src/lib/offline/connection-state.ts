"use client";

import { useSyncExternalStore } from "react";

export const OFFLINE_SESSION_KEY = "openbinder-offline-session";

const PING_URL = "/api/settings";
const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 3000;

const listeners = new Set<() => void>();
let pingTimer: number | null = null;
let pingInFlight = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function readOfflineSessionFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return sessionStorage.getItem(OFFLINE_SESSION_KEY) === "1";
}

function writeOfflineSessionFlag(offline: boolean): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const current = readOfflineSessionFlag();
  if (offline === current) {
    return false;
  }

  if (offline) {
    sessionStorage.setItem(OFFLINE_SESSION_KEY, "1");
  } else {
    sessionStorage.removeItem(OFFLINE_SESSION_KEY);
  }
  return true;
}

/**
 * Sticky offline state across full page navigations. Cleared by either an
 * `online` event or a successful periodic ping (since `navigator.onLine`
 * on localhost can stay `true` even while DevTools blocks all requests).
 */
export function getIsOnline(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return !readOfflineSessionFlag();
}

export function getIsOfflineView(): boolean {
  return !getIsOnline();
}

async function pingOnline(): Promise<boolean> {
  if (typeof window === "undefined") {
    return true;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PING_TIMEOUT_MS,
  );

  try {
    const res = await fetch(PING_URL, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeAndUpdate(force: boolean) {
  if (pingInFlight) {
    return;
  }

  if (!force && !readOfflineSessionFlag()) {
    return;
  }

  pingInFlight = true;
  try {
    const ok = await pingOnline();
    if (writeOfflineSessionFlag(!ok)) {
      notify();
    }
  } finally {
    pingInFlight = false;
  }
}

function ensurePingTimer() {
  if (pingTimer != null) {
    return;
  }
  pingTimer = window.setInterval(() => {
    void probeAndUpdate(false);
  }, PING_INTERVAL_MS);
}

function stopPingTimerIfUnused() {
  if (listeners.size === 0 && pingTimer != null) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  const onOffline = () => {
    if (writeOfflineSessionFlag(true)) {
      notify();
    }
  };

  const onOnline = () => {
    if (writeOfflineSessionFlag(false)) {
      notify();
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void probeAndUpdate(true);
    }
  };

  // Bootstrap: if the browser knows it is offline, mark immediately.
  if (!navigator.onLine) {
    writeOfflineSessionFlag(true);
  }

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onVisibility);
  document.addEventListener("visibilitychange", onVisibility);

  ensurePingTimer();

  // If we resumed with a stale flag (e.g. DevTools toggled online without a real
  // `online` event), validate immediately so the UI flips back without delay.
  if (readOfflineSessionFlag()) {
    void probeAndUpdate(true);
  }

  return () => {
    listeners.delete(callback);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onVisibility);
    document.removeEventListener("visibilitychange", onVisibility);
    stopPingTimerIfUnused();
  };
}

export function useConnectionOnline(): boolean {
  return useSyncExternalStore(subscribe, getIsOnline, () => true);
}

export function useIsOfflineView(): boolean {
  return !useConnectionOnline();
}

export function clearOfflineSessionFlag(): void {
  if (writeOfflineSessionFlag(false)) {
    notify();
  }
}
