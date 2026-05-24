import type { TranslateFn } from "@/lib/i18n/messages";
import { isWorkerRestartMessage } from "@/lib/sync-job-messages";

export { WORKER_RESTART_MESSAGE } from "@/lib/sync-job-messages";
export { formatSyncJobMessage } from "@/lib/sync-job-messages";

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
  t: TranslateFn,
): string {
  if (status === "failed" && isWorkerRestartMessage(message)) {
    return t("sync.jobStatusInterrupted");
  }

  switch (status) {
    case "pending":
      return t("sync.jobStatusPending");
    case "running":
      return t("sync.jobStatusRunning");
    case "completed":
      return t("sync.jobStatusCompleted");
    case "failed":
      return t("sync.jobStatusFailed");
    default:
      return status;
  }
}

export function formatJobTypeLabel(
  jobType: "catalog" | "set_cards" | "prices",
  setId: string | null | undefined,
  t: TranslateFn,
  setLabel?: string | null,
): string {
  switch (jobType) {
    case "catalog":
      return t("sync.jobTypeCatalog");
    case "set_cards":
      return setId || setLabel
        ? t("sync.jobTypeSetCardsWithId", {
            setId: setLabel ?? setId ?? "",
          })
        : t("sync.jobTypeSetCards");
    case "prices":
      return t("sync.jobTypePrices");
    default:
      return jobType;
  }
}

export function isActiveSyncJob(status: string): boolean {
  return status === "pending" || status === "running";
}

export function getSyncJobIssues(
  progress: SyncJobProgress | null | undefined,
  t: TranslateFn,
): SyncJobIssue[] {
  if (!progress) return [];

  const issues: SyncJobIssue[] = [];

  if (progress.failure) {
    const { failure } = progress;
    if (failure.kind === "set") {
      issues.push({
        kind: "set",
        title: failure.setName ?? failure.setId ?? t("sync.unknownSet"),
        detail: failure.error,
      });
    } else {
      issues.push({
        kind: "job",
        title: t("sync.jobAborted"),
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
  t: TranslateFn,
): string | null {
  const issues = getSyncJobIssues(progress, t);
  if (issues.length === 0) return null;

  const setFailures = issues.filter((issue) => issue.kind === "set").length;
  const jobFailures = issues.filter((issue) => issue.kind === "job").length;
  const cardFailures = issues.filter((issue) => issue.kind === "card").length;

  const parts: string[] = [];
  if (setFailures > 0) {
    parts.push(t("sync.issueSummarySets", { count: setFailures }));
  }
  if (jobFailures > 0) {
    parts.push(t("sync.issueSummaryJobError"));
  }
  if (cardFailures > 0) {
    parts.push(t("sync.issueSummaryCards", { count: cardFailures }));
  }

  return parts.join(", ");
}
