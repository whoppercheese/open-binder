import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { syncJobs } from "@/db/schema";
import {
  enqueueCatalogSync,
  enqueuePriceSync,
} from "@/jobs/boss";
import { findActiveSyncJob } from "@/jobs/sync-job-utils";

export async function GET() {
  try {
    const jobs = await db.query.syncJobs.findMany({
      orderBy: [desc(syncJobs.createdAt)],
      limit: 10,
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Sync-Status konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type as "catalog" | "prices";

    if (type !== "catalog" && type !== "prices") {
      return NextResponse.json(
        { error: "Ungültiger Sync-Typ." },
        { status: 400 },
      );
    }

    const activeJob = await findActiveSyncJob(type);
    if (activeJob) {
      return NextResponse.json(
        {
          error:
            type === "catalog"
              ? "Ein Sets-Sync läuft bereits oder wartet in der Queue."
              : "Ein Preis-Sync läuft bereits oder wartet in der Queue.",
          job: activeJob,
        },
        { status: 409 },
      );
    }

    const [job] = await db
      .insert(syncJobs)
      .values({ jobType: type, status: "pending" })
      .returning();

    if (type === "catalog") {
      await enqueueCatalogSync(job.id);
    } else {
      await enqueuePriceSync(job.id);
    }

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Sync konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}
