"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useConnectionOnline } from "@/lib/offline/connection-state";

export type OfflineScreen =
  | { kind: "list" }
  | { kind: "detail"; collectionId: string };

type OfflineNavigationValue = {
  screen: OfflineScreen;
  openCollection: (collectionId: string) => void;
  openList: () => void;
};

const OfflineNavigationContext =
  createContext<OfflineNavigationValue | null>(null);

function screenFromPathname(pathname: string): OfflineScreen {
  const match = pathname.match(/^\/collections\/([^/]+)/);
  if (match?.[1]) {
    return { kind: "detail", collectionId: match[1] };
  }
  return { kind: "list" };
}

export function OfflineNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOnline = useConnectionOnline();
  const [screen, setScreen] = useState<OfflineScreen>(() =>
    screenFromPathname(pathname),
  );
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (wasOnlineRef.current && !isOnline) {
      setScreen(screenFromPathname(pathname));
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, pathname]);

  const openCollection = useCallback((collectionId: string) => {
    setScreen({ kind: "detail", collectionId });
  }, []);

  const openList = useCallback(() => {
    setScreen({ kind: "list" });
  }, []);

  const value = useMemo(
    () => ({ screen, openCollection, openList }),
    [openCollection, openList, screen],
  );

  return (
    <OfflineNavigationContext.Provider value={value}>
      {children}
    </OfflineNavigationContext.Provider>
  );
}

export function useOfflineNavigation(): OfflineNavigationValue {
  const ctx = useContext(OfflineNavigationContext);
  if (!ctx) {
    throw new Error(
      "useOfflineNavigation must be used within OfflineNavigationProvider",
    );
  }
  return ctx;
}
