import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import {
  enqueueCatalogSync,
} from "@/jobs/boss";
import { findActiveSyncJob } from "@/jobs/sync-job-utils";
import { getRequestTranslator } from "@/lib/i18n/server";
import { resolveSetDisplayNames } from "@/lib/set-display-names";

export async function GET(request: Request) {
  const { locale, t } = getRequestTranslator(request);
  try {
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
      { error: t("errors.api.syncStatusLoadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { t } = getRequestTranslator(request);
  try {
    const body = await request.json();
    const type = body.type as string;

    if (type !== "catalog") {
      return NextResponse.json(
        { error: t("errors.api.syncInvalidType") },
        { status: 400 },
      );
    }

    const activeJob = await findActiveSyncJob("catalog");
    if (activeJob) {
      return NextResponse.json(
        {
          error: t("errors.api.syncCatalogAlreadyRunning"),
          job: activeJob,
        },
        { status: 409 },
      );
    }

    const [job] = await db
      .insert(syncJobs)
      .values({ jobType: "catalog", status: "pending" })
      .returning();

    await enqueueCatalogSync(job!.id);

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("errors.api.syncStartFailed") },
      { status: 500 },
    );
  }
}
