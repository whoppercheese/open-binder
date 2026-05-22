import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://binder:binder@localhost:5432/binder";

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("[migrate] Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("[migrate] Done");
  await client.end();
}

main().catch((error) => {
  console.error("[migrate] Failed", error);
  process.exit(1);
});
