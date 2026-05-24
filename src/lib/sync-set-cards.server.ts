import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import { enqueueSetCardsSync } from "@/jobs/boss";
import { findActiveSetCardsJob } from "@/jobs/sync-job-utils";
import { ensureSetMetadata } from "@/lib/set-metadata.server";

export async function createSetCardsSyncJob(setId: string) {
  let set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    const ensured = await ensureSetMetadata(setId);
    if (!ensured) {
      return { error: "Set nicht gefunden.", status: 404 as const };
    }
    set = await db.query.sets.findFirst({
      where: eq(sets.id, setId),
    });
  }

  if (!set) {
    return { error: "Set nicht gefunden.", status: 404 as const };
  }

  const activeJob = await findActiveSetCardsJob(setId);
  if (activeJob) {
    return {
      error: "Ein Karten-Sync für dieses Set läuft bereits oder wartet in der Queue.",
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
