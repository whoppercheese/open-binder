"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOffline } from "@/lib/offline/offline-provider";

function isCollectionsPath(pathname: string): boolean {
  return pathname === "/collections" || pathname.startsWith("/collections/");
}

export function OfflineRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOfflineView } = useOffline();

  useEffect(() => {
    if (isOfflineView && !isCollectionsPath(pathname)) {
      // Client-side navigation keeps the loaded app shell; a full document
      // navigation fails on iOS Safari offline even when the SW has HTML cached.
      router.replace("/collections");
    }
  }, [isOfflineView, pathname, router]);

  return null;
}
