import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { getRequestTranslator } from "@/lib/i18n/server";
import { supportedCatalogSetsWhere } from "@/lib/sets-list-catalog";
import {
  findActiveSyncJob,
  getActiveSetCardsJobs,
} from "@/jobs/sync-job-utils";

export async function GET(request: Request) {
  const { t } = getRequestTranslator(request);
  try {
    const [setCardsJobs, catalogJob, setCountRow] = await Promise.all([
      getActiveSetCardsJobs(),
      findActiveSyncJob("catalog"),
      db
        .select({ count: count() })
        .from(sets)
        .where(supportedCatalogSetsWhere()),
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
      { error: t("errors.api.syncStatusLoadFailed") },
      { status: 500 },
    );
  }
}
