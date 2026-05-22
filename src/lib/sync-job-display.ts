export const WORKER_RESTART_MESSAGE =
  "Unterbrochen durch Worker-Neustart";

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
