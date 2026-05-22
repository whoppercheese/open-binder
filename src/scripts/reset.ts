import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { ensureImageStorageDir, getImageStorageRoot } from "@/lib/image-storage";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://binder:binder@localhost:5432/binder";

async function clearDatabase(sql: postgres.Sql) {
  await sql.unsafe(`
    TRUNCATE TABLE
      user_cards,
      card_prices,
      card_variants,
      cards,
      sets,
      sync_jobs,
      cardmarket_products,
      app_settings
    RESTART IDENTITY CASCADE
  `);

  await sql.unsafe(`DROP SCHEMA IF EXISTS pgboss CASCADE`);
}

async function clearImageStorage() {
  const root = getImageStorageRoot();
  if (existsSync(root)) {
    await rm(root, { recursive: true, force: true });
  }
  await ensureImageStorageDir();
}

async function main() {
  const force = process.argv.includes("--force");

  if (!force) {
    console.error("[reset] Abgebrochen. Nutze: npm run reset -- --force");
    process.exit(1);
  }

  console.log("[reset] Leere Datenbank…");
  const sql = postgres(connectionString, { max: 1 });

  try {
    await clearDatabase(sql);
    console.log("[reset] Datenbank geleert (inkl. pg-boss Jobs).");
  } finally {
    await sql.end();
  }

  console.log(`[reset] Leere Bildspeicher unter ${path.resolve(getImageStorageRoot())}…`);
  await clearImageStorage();
  console.log("[reset] Bildspeicher geleert.");

  console.log("[reset] Fertig. Starte Worker neu, um Katalog-Sync auszulösen.");
}

main().catch((error) => {
  console.error("[reset] Fehlgeschlagen:", error);
  process.exit(1);
});
