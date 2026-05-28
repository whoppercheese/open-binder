import { NextResponse } from "next/server";
import {
  createSetCardsSyncJob,
  createSetCardsSyncJobsForAllSets,
} from "@/lib/sync-set-cards.server";
import { getSetCardsSyncStatuses } from "@/jobs/sync-job-utils";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(request: Request) {
  const { t } = getRequestTranslator(request);
  try {
    const { searchParams } = new URL(request.url);
    const setIdsParam = searchParams.get("setIds");

    if (!setIdsParam) {
      return NextResponse.json(
        { error: t("errors.api.setCardsMissingSetIds") },
        { status: 400 },
      );
    }

    const setIds = setIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (setIds.length === 0) {
      return NextResponse.json({ sets: [] });
    }

    const [setRows, syncStatuses] = await Promise.all([
      db.query.sets.findMany({
        where: inArray(sets.id, setIds),
        columns: { id: true, cardsSyncedAt: true },
      }),
      getSetCardsSyncStatuses(setIds),
    ]);

    const syncedAtBySetId = new Map(
      setRows.map((set) => [set.id, set.cardsSyncedAt]),
    );
    const statusBySetId = new Map(
      syncStatuses.map((status) => [status.setId, status.activeJob]),
    );

    return NextResponse.json({
      sets: setIds.map((setId) => ({
        setId,
        cardsSyncedAt: syncedAtBySetId.get(setId)?.toISOString() ?? null,
        activeJob: statusBySetId.get(setId) ?? null,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("errors.api.setCardsStatusLoadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { t } = getRequestTranslator(request);
  try {
    const body = await request.json();

    if (body.all === true) {
      const result = await createSetCardsSyncJobsForAllSets();
      return NextResponse.json(
        { enqueued: result.enqueued, skipped: result.skipped },
        { status: result.status },
      );
    }

    const setId = body.setId as string | undefined;

    if (!setId?.trim()) {
      return NextResponse.json(
        { error: t("errors.api.setCardsMissingSetId") },
        { status: 400 },
      );
    }

    const result = await createSetCardsSyncJob(setId.trim());

    if ("errorKey" in result && typeof result.errorKey === "string") {
      return NextResponse.json(
        {
          error: t(result.errorKey),
          job: "job" in result ? result.job : undefined,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({ job: result.job }, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("errors.api.setCardsStartFailed") },
      { status: 500 },
    );
  }
}
