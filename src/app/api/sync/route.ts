import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import {
  enqueueCatalogSync,
  enqueuePriceSync,
} from "@/jobs/boss";
import { findActiveSyncJob } from "@/jobs/sync-job-utils";
import { getRequestTranslator } from "@/lib/i18n/server";
import { resolveSetDisplayNames } from "@/lib/set-progress.server";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const jobs = await db.query.syncJobs.findMany({
      orderBy: [desc(syncJobs.createdAt)],
      limit: 10,
    });

    const setIds = [
      ...new Set(
        jobs
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

    const setNameById = resolveSetDisplayNames(setRows, locale);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        setName: job.setId
          ? (setNameById.get(job.setId) ?? job.setId)
          : null,
      })),
    });
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
