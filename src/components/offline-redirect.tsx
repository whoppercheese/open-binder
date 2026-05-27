"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOffline } from "@/lib/offline/offline-provider";

function isCollectionsPath(pathname: string): boolean {
  return pathname === "/collections" || pathname.startsWith("/collections/");
}

export function OfflineRedirect() {
  const pathname = usePathname();
  const { isOfflineView } = useOffline();

  useEffect(() => {
    if (isOfflineView && !isCollectionsPath(pathname)) {
      window.location.replace("/collections");
    }
  }, [isOfflineView, pathname]);

  return null;
}
