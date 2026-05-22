import { and, desc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { syncJobs } from "@/db/schema";
import {
  WORKER_RESTART_MESSAGE,
  type CatalogCardError,
  type SyncJobFailure,
  type SyncJobProgress,
} from "@/lib/sync-job-display";

export type { CatalogCardError, SyncJobFailure, SyncJobProgress };

const ORPHAN_GRACE_MS = 2 * 60 * 1000;

export async function markOrphanedSyncJobs() {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - ORPHAN_GRACE_MS);

  const orphaned = await db
    .update(syncJobs)
    .set({
      status: "failed",
      finishedAt: now,
      message: WORKER_RESTART_MESSAGE,
    })
    .where(
      or(
        eq(syncJobs.status, "running"),
        and(
          eq(syncJobs.status, "pending"),
          lt(syncJobs.createdAt, graceCutoff),
        ),
      ),
    )
    .returning({ id: syncJobs.id });

  if (orphaned.length > 0) {
    console.log(
      `[worker] Marked ${orphaned.length} orphaned sync job(s) as failed`,
    );
  }

  return orphaned.length;
}

export async function findActiveSyncJob(jobType: "catalog" | "prices") {
  return db.query.syncJobs.findFirst({
    where: and(
      eq(syncJobs.jobType, jobType),
      inArray(syncJobs.status, ["pending", "running"]),
    ),
    orderBy: [desc(syncJobs.createdAt)],
  });
}

export async function getResumeProcessedSetIds(
  jobId: string,
  jobType: "catalog",
): Promise<string[]> {
  const job = await db.query.syncJobs.findFirst({
    where: eq(syncJobs.id, jobId),
  });

  const fromJob = (job?.progress as SyncJobProgress | null)?.processedSetIds;
  if (fromJob && fromJob.length > 0) {
    return fromJob;
  }

  const lastInterrupted = await db.query.syncJobs.findFirst({
    where: and(
      eq(syncJobs.jobType, jobType),
      eq(syncJobs.status, "failed"),
      eq(syncJobs.message, WORKER_RESTART_MESSAGE),
      ne(syncJobs.id, jobId),
    ),
    orderBy: [desc(syncJobs.finishedAt)],
  });

  if (!lastInterrupted?.finishedAt) {
    return [];
  }

  const completedAfterInterrupt = await db.query.syncJobs.findFirst({
    where: and(
      eq(syncJobs.jobType, jobType),
      eq(syncJobs.status, "completed"),
      gt(syncJobs.finishedAt, lastInterrupted.finishedAt),
    ),
  });

  if (completedAfterInterrupt) {
    return [];
  }

  return (
    (lastInterrupted.progress as SyncJobProgress | null)?.processedSetIds ?? []
  );
}

export async function appendCatalogProgress(
  jobId: string,
  setId: string,
  processedSetIds: string[],
  message: string,
  cardErrors?: CatalogCardError[],
) {
  const updatedIds = [...processedSetIds, setId];
  await db
    .update(syncJobs)
    .set({
      progress: {
        processedSetIds: updatedIds,
        ...(cardErrors && cardErrors.length > 0 ? { cardErrors } : {}),
      },
      message,
    })
    .where(eq(syncJobs.id, jobId));
  return updatedIds;
}
