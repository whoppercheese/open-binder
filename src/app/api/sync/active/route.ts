import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import {
  findActiveSyncJob,
  getActiveSetCardsJobs,
} from "@/jobs/sync-job-utils";

export async function GET() {
  try {
    const [setCardsJobs, catalogJob, setCountRow] = await Promise.all([
      getActiveSetCardsJobs(),
      findActiveSyncJob("catalog"),
      db.select({ count: count() }).from(sets),
    ]);

    return NextResponse.json({
      setCount: setCountRow[0]?.count ?? 0,
      setCardsJobs,
      catalogJob: catalogJob
        ? {
            id: catalogJob.id,
            status: catalogJob.status,
            message: catalogJob.message,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Sync-Status konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
