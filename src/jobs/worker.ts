import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { syncJobs } from "@/db/schema";
import {
  ensureQueues,
  getBoss,
  JOB_CATALOG_SYNC,
  JOB_PRICE_SYNC,
  scheduleRecurringJobs,
} from "./boss";
import { runCatalogSync } from "./sync-catalog";
import { runPriceSync } from "./sync-prices";

async function main() {
  console.log("[worker] Starting Binder sync worker…");
  const boss = await getBoss();
  await ensureQueues();
  await scheduleRecurringJobs();

  await boss.work(JOB_CATALOG_SYNC, async (jobs) => {
    for (const job of jobs) {
      console.log("[worker] Catalog sync started");
      const jobId = (job.data as { jobId?: string }).jobId;
      await runCatalogSync(jobId);
      console.log("[worker] Catalog sync finished");
    }
  });

  await boss.work(JOB_PRICE_SYNC, async (jobs) => {
    for (const job of jobs) {
      console.log("[worker] Price sync started");
      const jobId = (job.data as { jobId?: string }).jobId;
      await runPriceSync(jobId);
      console.log("[worker] Price sync finished");
    }
  });

  const shouldBootstrap =
    process.env.BOOTSTRAP_CATALOG_SYNC === "true" ||
    process.env.NODE_ENV !== "production";

  if (shouldBootstrap) {
    const existingSets = await db.query.sets.findFirst();
    if (!existingSets) {
      console.log("[worker] No catalog found — enqueueing initial catalog sync");
      const [bootstrapJob] = await db
        .insert(syncJobs)
        .values({ jobType: "catalog", status: "pending" })
        .returning();
      await boss.send(JOB_CATALOG_SYNC, { jobId: bootstrapJob.id });
    }
  }

  console.log("[worker] Ready");
}

main().catch(async (error) => {
  console.error("[worker] Fatal error", error);
  process.exit(1);
});

export async function getLatestSyncJob(jobType: "catalog" | "prices") {
  return db.query.syncJobs.findFirst({
    where: eq(syncJobs.jobType, jobType),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
}
