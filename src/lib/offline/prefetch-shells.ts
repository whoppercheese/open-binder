import { getIsOnline } from "@/lib/offline/connection-state";
import { mapWithConcurrency } from "@/lib/offline/utils";

const SHELL_CONCURRENCY = 2;

async function prefetchHtmlShell(path: string): Promise<void> {
  await fetch(path, {
    credentials: "same-origin",
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });
}

export async function prefetchCollectionShells(
  collectionIds: string[],
): Promise<void> {
  if (typeof window === "undefined" || !getIsOnline()) {
    return;
  }

  const paths = [
    "/collections",
    ...collectionIds.map((id) => `/collections/${id}`),
  ];

  await mapWithConcurrency(paths, SHELL_CONCURRENCY, async (path) => {
    try {
      await prefetchHtmlShell(path);
    } catch {
      // Best-effort shell warm-up for offline navigation.
    }
  });
}
