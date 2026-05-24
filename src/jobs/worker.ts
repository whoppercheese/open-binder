import { db } from "@/db/client";
import { syncJobs } from "@/db/schema";
import { loadEnvFile } from "@/lib/load-env";
import {
  ensureQueues,
  getBoss,
  JOB_CATALOG_SYNC,
  JOB_PRICE_SYNC,
  JOB_SET_CARDS_SYNC,
  scheduleRecurringJobs,
} from "./boss";
import {
  runSetCardsSync,
  runSetsSync,
  runWeeklyCatalogRefresh,
} from "./sync-catalog";
import { runPriceSync } from "./sync-prices";
import { requeueInterruptedSyncJobs } from "./sync-job-utils";

loadEnvFile();

async function main() {
  console.log("[worker] Starting OpenBinder sync worker…");
  const boss = await getBoss();
  await ensureQueues();
  await requeueInterruptedSyncJobs();
  await scheduleRecurringJobs();

  await boss.work(JOB_CATALOG_SYNC, async (jobs) => {
    for (const job of jobs) {
      const jobId = (job.data as { jobId?: string }).jobId;
      if (jobId) {
        console.log("[worker] Sets sync started");
        await runSetsSync(jobId);
        console.log("[worker] Sets sync finished");
      } else {
        console.log("[worker] Weekly catalog refresh started");
        await runWeeklyCatalogRefresh();
        console.log("[worker] Weekly catalog refresh finished");
      }
    }
  });

  await boss.work(JOB_SET_CARDS_SYNC, async (jobs) => {
    for (const job of jobs) {
      const { jobId, setId } = job.data as {
        jobId?: string;
        setId?: string;
      };

      if (!setId) {
        console.warn("[worker] Set cards sync job missing setId");
        continue;
      }

      console.log(`[worker] Set cards sync started for ${setId}`);
      await runSetCardsSync(setId, jobId);
      console.log(`[worker] Set cards sync finished for ${setId}`);
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
      console.log("[worker] No catalog found — enqueueing initial sets sync");
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
