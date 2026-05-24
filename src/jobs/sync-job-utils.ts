import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import { getLocalizedString } from "@/lib/catalog-languages";
import {
  enqueueCatalogSync,
  enqueuePriceSync,
  enqueueSetCardsSync,
} from "@/jobs/boss";
import type {
  CatalogCardError,
  SyncJobFailure,
  SyncJobProgress,
} from "@/lib/sync-job-display";

export type { CatalogCardError, SyncJobFailure, SyncJobProgress };

const ORPHAN_GRACE_MS = 2 * 60 * 1000;

export async function requeueInterruptedSyncJobs() {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - ORPHAN_GRACE_MS);

  const interrupted = await db.query.syncJobs.findMany({
    where: or(
      eq(syncJobs.status, "running"),
      and(eq(syncJobs.status, "pending"), lt(syncJobs.createdAt, graceCutoff)),
    ),
  });

  if (interrupted.length === 0) {
    return 0;
  }

  for (const job of interrupted) {
    await db
      .update(syncJobs)
      .set({
        status: "pending",
        message: null,
        progress: null,
        startedAt: null,
        finishedAt: null,
      })
      .where(eq(syncJobs.id, job.id));

    if (job.jobType === "catalog") {
      await enqueueCatalogSync(job.id);
    } else if (job.jobType === "set_cards" && job.setId) {
      await enqueueSetCardsSync(job.id, job.setId);
    } else if (job.jobType === "prices") {
      await enqueuePriceSync(job.id);
    }
  }

  console.log(
    `[worker] Requeued ${interrupted.length} interrupted sync job(s)`,
  );

  return interrupted.length;
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

export async function findActiveSetCardsJob(setId: string) {
  return db.query.syncJobs.findFirst({
    where: and(
      eq(syncJobs.jobType, "set_cards"),
      eq(syncJobs.setId, setId),
      inArray(syncJobs.status, ["pending", "running"]),
    ),
    orderBy: [desc(syncJobs.createdAt)],
  });
}

export async function getSetCardsSyncStatuses(setIds: string[]) {
  if (setIds.length === 0) {
    return [];
  }

  const activeJobs = await db.query.syncJobs.findMany({
    where: and(
      eq(syncJobs.jobType, "set_cards"),
      inArray(syncJobs.setId, setIds),
      inArray(syncJobs.status, ["pending", "running"]),
    ),
    orderBy: [desc(syncJobs.createdAt)],
  });

  const activeBySetId = new Map<string, (typeof activeJobs)[number]>();
  for (const job of activeJobs) {
    if (job.setId && !activeBySetId.has(job.setId)) {
      activeBySetId.set(job.setId, job);
    }
  }

  return setIds.map((setId) => {
    const activeJob = activeBySetId.get(setId);
    return {
      setId,
      activeJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
            message: activeJob.message,
          }
        : null,
    };
  });
}

export async function getActiveSetCardsJobs() {
  const activeJobs = await db.query.syncJobs.findMany({
    where: and(
      eq(syncJobs.jobType, "set_cards"),
      inArray(syncJobs.status, ["pending", "running"]),
    ),
    orderBy: [desc(syncJobs.createdAt)],
  });

  if (activeJobs.length === 0) {
    return [];
  }

  const setIds = [
    ...new Set(
      activeJobs
        .map((job) => job.setId)
        .filter((setId): setId is string => setId != null),
    ),
  ];

  const setRows =
    setIds.length > 0
      ? await db.query.sets.findMany({
          where: inArray(sets.id, setIds),
          columns: { id: true, names: true },
        })
      : [];

  const setNameById = new Map(
    setRows.map((set) => [
      set.id,
      getLocalizedString(set.names, "en") ?? set.id,
    ]),
  );

  const activeBySetId = new Map<string, (typeof activeJobs)[number]>();
  for (const job of activeJobs) {
    if (!job.setId) continue;
    const existing = activeBySetId.get(job.setId);
    if (
      !existing ||
      (existing.status === "pending" && job.status === "running")
    ) {
      activeBySetId.set(job.setId, job);
    }
  }

  return Array.from(activeBySetId.values()).map((job) => ({
    id: job.id,
    setId: job.setId!,
    setName: setNameById.get(job.setId!) ?? job.setId!,
    status: job.status,
    message: job.message,
  }));
}
