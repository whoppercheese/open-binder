"use client";

import type { ReactNode } from "react";
import CollectionListPage from "@/app/(mobile)/collections/page";
import { CollectionDetailView } from "@/app/(mobile)/collections/[id]/page";
import { useOffline } from "@/lib/offline/offline-provider";
import { useOfflineNavigation } from "@/lib/offline/offline-navigation";

/**
 * While offline, render collections UI from in-memory navigation state instead
 * of Next.js route changes (iOS Safari shows a native error for failed navigations).
 */
export function OfflineShell({ children }: { children: ReactNode }) {
  const { isOfflineView } = useOffline();
  const { screen } = useOfflineNavigation();

  if (!isOfflineView) {
    return children;
  }

  if (screen.kind === "detail") {
    return <CollectionDetailView collectionId={screen.collectionId} />;
  }

  return <CollectionListPage />;
}
