import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import { enqueueSetCardsSync } from "@/jobs/boss";
import { findActiveSetCardsJob } from "@/jobs/sync-job-utils";
import { ensureSetMetadata } from "@/lib/set-metadata.server";

export async function createSetCardsSyncJobsForAllSets() {
  const [allSets, activeJobs] = await Promise.all([
    db.query.sets.findMany({
      columns: { id: true },
    }),
    db.query.syncJobs.findMany({
      where: and(
        eq(syncJobs.jobType, "set_cards"),
        inArray(syncJobs.status, ["pending", "running"]),
      ),
      columns: { setId: true },
    }),
  ]);

  const activeSetIds = new Set(
    activeJobs
      .map((job) => job.setId)
      .filter((setId): setId is string => setId != null),
  );

  let enqueued = 0;
  let skipped = 0;

  for (const set of allSets) {
    if (activeSetIds.has(set.id)) {
      skipped += 1;
      continue;
    }

    const [job] = await db
      .insert(syncJobs)
      .values({
        jobType: "set_cards",
        setId: set.id,
        status: "pending",
      })
      .returning();

    await enqueueSetCardsSync(job.id, set.id);
    enqueued += 1;
  }

  return { enqueued, skipped, status: 202 as const };
}

export async function createSetCardsSyncJob(setId: string) {
  let set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    const ensured = await ensureSetMetadata(setId);
    if (!ensured) {
      return { errorKey: "errors.api.setNotFound", status: 404 as const };
    }
    set = await db.query.sets.findFirst({
      where: eq(sets.id, setId),
    });
  }

  if (!set) {
    return { errorKey: "errors.api.setNotFound", status: 404 as const };
  }

  const activeJob = await findActiveSetCardsJob(setId);
  if (activeJob) {
    return {
      errorKey: "errors.api.setCardsAlreadyRunningForSet",
      job: activeJob,
      status: 409 as const,
    };
  }

  const [job] = await db
    .insert(syncJobs)
    .values({
      jobType: "set_cards",
      setId,
      status: "pending",
    })
    .returning();

  await enqueueSetCardsSync(job.id, setId);

  return { job, status: 202 as const };
}
