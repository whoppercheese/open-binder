import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss() {
  if (boss) return boss;

  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://binder:binder@localhost:5432/binder";

  boss = new PgBoss({
    connectionString,
    schema: "pgboss",
  });

  boss.on("error", (error) => {
    console.error("[pg-boss]", error);
  });

  await boss.start();
  return boss;
}

export const JOB_CATALOG_SYNC = "catalog-sync";
export const JOB_PRICE_SYNC = "price-sync";

export async function ensureQueues() {
  const instance = await getBoss();
  await instance.createQueue(JOB_CATALOG_SYNC);
  await instance.createQueue(JOB_PRICE_SYNC);
  return instance;
}

export async function enqueueCatalogSync(jobId: string) {
  const instance = await ensureQueues();
  return instance.send(JOB_CATALOG_SYNC, { jobId });
}

export async function enqueuePriceSync(jobId: string) {
  const instance = await ensureQueues();
  return instance.send(JOB_PRICE_SYNC, { jobId });
}

export async function scheduleRecurringJobs() {
  const instance = await ensureQueues();

  await instance.schedule(JOB_CATALOG_SYNC, "0 3 * * 0", {}, { tz: "UTC" });
  await instance.schedule(JOB_PRICE_SYNC, "0 4 * * *", {}, { tz: "UTC" });
}
