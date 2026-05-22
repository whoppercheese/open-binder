export const WORKER_RESTART_MESSAGE =
  "Unterbrochen durch Worker-Neustart";

export type CatalogCardError = {
  setId: string;
  setName?: string;
  cardId: string;
  error: string;
};

export type SyncJobFailure = {
  kind: "set" | "job";
  setId?: string;
  setName?: string;
  error: string;
};

export type SyncJobProgress = {
  processedSetIds?: string[];
  cardErrors?: CatalogCardError[];
  failure?: SyncJobFailure;
};

export type SyncJobIssue = {
  kind: "set" | "card" | "job";
  title: string;
  detail: string;
};

export function formatJobStatusLabel(
  status: string,
  message: string | null,
): string {
  if (status === "failed" && message === WORKER_RESTART_MESSAGE) {
    return "unterbrochen (Neustart)";
  }

  switch (status) {
    case "pending":
      return "wartend";
    case "running":
      return "läuft";
    case "completed":
      return "abgeschlossen";
    case "failed":
      return "fehlgeschlagen";
    default:
      return status;
  }
}

export function formatJobTypeLabel(jobType: "catalog" | "prices"): string {
  return jobType === "catalog" ? "Katalog" : "Preise";
}

export function isActiveSyncJob(status: string): boolean {
  return status === "pending" || status === "running";
}

export function getSyncJobIssues(
  progress: SyncJobProgress | null | undefined,
): SyncJobIssue[] {
  if (!progress) return [];

  const issues: SyncJobIssue[] = [];

  if (progress.failure) {
    const { failure } = progress;
    if (failure.kind === "set") {
      issues.push({
        kind: "set",
        title: failure.setName ?? failure.setId ?? "Unbekanntes Set",
        detail: failure.error,
      });
    } else {
      issues.push({
        kind: "job",
        title: "Job abgebrochen",
        detail: failure.error,
      });
    }
  }

  for (const cardError of progress.cardErrors ?? []) {
    issues.push({
      kind: "card",
      title: `${cardError.setName ?? cardError.setId} · ${cardError.cardId}`,
      detail: cardError.error,
    });
  }

  return issues;
}

export function formatSyncJobIssueSummary(
  progress: SyncJobProgress | null | undefined,
): string | null {
  const issues = getSyncJobIssues(progress);
  if (issues.length === 0) return null;

  const setFailures = issues.filter((issue) => issue.kind === "set").length;
  const jobFailures = issues.filter((issue) => issue.kind === "job").length;
  const cardFailures = issues.filter((issue) => issue.kind === "card").length;

  const parts: string[] = [];
  if (setFailures > 0) {
    parts.push(`${setFailures} Set${setFailures === 1 ? "" : "s"}`);
  }
  if (jobFailures > 0) {
    parts.push("Job-Fehler");
  }
  if (cardFailures > 0) {
    parts.push(
      `${cardFailures} Karte${cardFailures === 1 ? "" : "n"}`,
    );
  }

  return parts.join(", ");
}
