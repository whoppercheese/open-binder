"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getIsOnline,
  useConnectionOnline,
} from "@/lib/offline/connection-state";
import { hasOfflineData, getOfflineMeta } from "@/lib/offline/db";
import {
  scheduleCollectionMirror,
  scheduleFullMirror,
  syncMirror,
} from "@/lib/offline/mirror";
import {
  COLLECTION_MUTATED_EVENT,
  FULL_MIRROR_EVENT,
  notifyFullMirror,
  OFFLINE_SCHEMA_VERSION,
  type CollectionMutatedDetail,
} from "@/lib/offline/types";
import { useLocale } from "@/lib/i18n/context";

type OfflineContextValue = {
  isOnline: boolean;
  isOfflineView: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  hasCachedData: boolean;
  cacheReady: boolean;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const isOnline = useConnectionOnline();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  const refreshMeta = useCallback(async () => {
    try {
      const [meta, cached] = await Promise.all([
        getOfflineMeta(),
        hasOfflineData(),
      ]);
      setLastSyncedAt(meta?.lastFullSyncAt ?? null);
      setHasCachedData(cached);
      if (meta && meta.schemaVersion !== OFFLINE_SCHEMA_VERSION) {
        notifyFullMirror();
      }
    } catch {
      setHasCachedData(false);
    } finally {
      setCacheReady(true);
    }
  }, []);

  const runMirror = useCallback(async () => {
    if (!getIsOnline()) {
      return;
    }

    setSyncing(true);
    try {
      await syncMirror(locale);
      await refreshMeta();
    } finally {
      setSyncing(false);
    }
  }, [locale, refreshMeta]);

  useEffect(() => {
    void refreshMeta();

    const onOnline = () => {
      void runMirror();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && getIsOnline()) {
        void runMirror();
      }
    };
    const onCollectionMutated = (event: Event) => {
      const detail = (event as CustomEvent<CollectionMutatedDetail>).detail;
      if (detail.collectionId) {
        scheduleCollectionMirror(detail.collectionId, locale);
      } else {
        scheduleFullMirror(locale);
      }
      void refreshMeta();
    };
    const onFullMirror = () => {
      scheduleFullMirror(locale);
      void refreshMeta();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(COLLECTION_MUTATED_EVENT, onCollectionMutated);
    window.addEventListener(FULL_MIRROR_EVENT, onFullMirror);

    void runMirror();

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(COLLECTION_MUTATED_EVENT, onCollectionMutated);
      window.removeEventListener(FULL_MIRROR_EVENT, onFullMirror);
    };
  }, [locale, refreshMeta, runMirror]);

  const value = useMemo(
    () => ({
      isOnline,
      isOfflineView: !isOnline,
      lastSyncedAt,
      syncing,
      hasCachedData,
      cacheReady,
    }),
    [cacheReady, hasCachedData, isOnline, lastSyncedAt, syncing],
  );

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return ctx;
}
