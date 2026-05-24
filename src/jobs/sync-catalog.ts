import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { sets, syncJobs } from "@/db/schema";
import { syncSetCards } from "@/lib/catalog-card-sync.server";
import { getLocalizedString } from "@/lib/catalog-languages";
import {
  upsertSetMetadataFromSummary,
} from "@/lib/set-metadata.server";
import { encodeSyncJobMessage } from "@/lib/sync-job-messages";
import type {
  CatalogCardError,
  SyncJobFailure,
  SyncJobProgress,
} from "@/lib/sync-job-display";
import {
  fetchCatalogSets,
  type TcgdexSetSummary,
} from "@/lib/tcgdex";
import { enqueueSetCardsSync } from "@/jobs/boss";
import {
  findActiveSetCardsJob,
  withSyncJob,
} from "@/jobs/sync-job-utils";

function getCatalogSetIdsFilter(): string[] | null {
  const raw = process.env.CATALOG_SET_IDS?.trim();
  if (!raw) return null;

  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : null;
}

function applyCatalogSetFilter(
  catalogSets: TcgdexSetSummary[],
  filterIds: string[],
): TcgdexSetSummary[] {
  const setsById = new Map(catalogSets.map((set) => [set.id, set]));

  return filterIds.flatMap((id) => {
    const set = setsById.get(id);
    if (!set) {
      console.warn(`[catalog] Unknown set id in CATALOG_SET_IDS: ${id}`);
      return [];
    }
    return [set];
  });
}

function buildJobProgress(
  cardErrors: CatalogCardError[],
  failure?: SyncJobFailure,
): SyncJobProgress {
  return {
    ...(cardErrors.length > 0 ? { cardErrors } : {}),
    ...(failure ? { failure } : {}),
  };
}

export async function runSetsSync(jobId?: string) {
  return withSyncJob({
    jobId,
    onStart: () => encodeSyncJobMessage("catalogStarting"),
    run: async () => {
      const catalogSetIds = getCatalogSetIdsFilter();
      let allSets = await fetchCatalogSets();

      if (catalogSetIds) {
        allSets = applyCatalogSetFilter(allSets, catalogSetIds);
        console.log(
          `[catalog] Syncing ${allSets.length} set(s) from CATALOG_SET_IDS (${catalogSetIds.length} requested)`,
        );

        if (jobId) {
          await db
            .update(syncJobs)
            .set({
              message: encodeSyncJobMessage("catalogForSetsCount", {
                count: allSets.length,
              }),
            })
            .where(eq(syncJobs.id, jobId));
        }
      }

      for (let index = 0; index < allSets.length; index += 1) {
        const setSummary = allSets[index];

        try {
          await upsertSetMetadataFromSummary(setSummary);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unbekannter Set-Fehler";
          console.error(
            `[catalog] Failed to sync set ${setSummary.id}: ${message}`,
          );
          if (jobId) {
            await db
              .update(syncJobs)
              .set({
                status: "failed",
                finishedAt: new Date(),
                progress: buildJobProgress([], {
                  kind: "set",
                  setId: setSummary.id,
                  setName: setSummary.name,
                  error: message,
                }),
                message,
              })
              .where(eq(syncJobs.id, jobId));
          }
          throw error;
        }

        if (jobId) {
          await db
            .update(syncJobs)
            .set({
              message: encodeSyncJobMessage("catalogSetProgress", {
                current: index + 1,
                total: allSets.length,
                name: setSummary.name,
              }),
            })
            .where(eq(syncJobs.id, jobId));
        }
      }

      return { setsProcessed: allSets.length };
    },
    onComplete: (result) => ({
      message: encodeSyncJobMessage("catalogCompleted", {
        count: result.setsProcessed,
      }),
      progress: buildJobProgress([]),
    }),
    onError: (error) => ({
      message:
        error instanceof Error ? error.message : "Unbekannter Fehler beim Sets-Sync",
      progress: buildJobProgress([], {
        kind: "job",
        error:
          error instanceof Error ? error.message : "Unbekannter Fehler beim Sets-Sync",
      }),
    }),
  });
}

export async function runSetCardsSync(setId: string, jobId?: string) {
  const set = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
  });

  if (!set) {
    throw new Error(`Set not found: ${setId}`);
  }

  const setDisplayName = getLocalizedString(set.names, "en") ?? set.id;
  const cardErrors: CatalogCardError[] = [];

  return withSyncJob({
    jobId,
    onStart: () =>
      encodeSyncJobMessage("setCardsStarting", {
        setName: setDisplayName,
      }),
    run: async () => {
      const detail = await syncSetCards(setId, cardErrors, async (message) => {
        if (jobId) {
          await db
            .update(syncJobs)
            .set({ message, progress: buildJobProgress(cardErrors) })
            .where(eq(syncJobs.id, jobId));
        }
      });

      const finishedAt = new Date();

      await db
        .update(sets)
        .set({ cardsSyncedAt: finishedAt, updatedAt: finishedAt })
        .where(eq(sets.id, setId));

      if (cardErrors.length > 0) {
        console.warn(
          `[catalog] Set ${setId} completed with ${cardErrors.length} skipped card(s)`,
        );
      }

      return { setId, detail, cardErrors: cardErrors.length };
    },
    onComplete: (result) => ({
      message:
        result.cardErrors === 0
          ? encodeSyncJobMessage("setCardsCompleted", {
              setName: result.detail.name,
            })
          : encodeSyncJobMessage("setCardsCompletedWithSkips", {
              setName: result.detail.name,
              skipped: result.cardErrors,
            }),
      progress: buildJobProgress(cardErrors),
    }),
    onError: (error) => ({
      message:
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Karten-Sync",
      progress: buildJobProgress(cardErrors, {
        kind: "job",
        setId,
        setName: setDisplayName,
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler beim Karten-Sync",
      }),
    }),
  });
}

export async function runWeeklyCatalogRefresh() {
  await runSetsSync();

  const syncedSets = await db.query.sets.findMany({
    where: isNotNull(sets.cardsSyncedAt),
    columns: { id: true, names: true },
  });

  let enqueued = 0;

  for (const set of syncedSets) {
    const activeJob = await findActiveSetCardsJob(set.id);
    if (activeJob) {
      continue;
    }

    const [job] = await db
      .insert(syncJobs)
      .values({
        jobType: "set_cards",
        setId: set.id,
        status: "pending",
        message: encodeSyncJobMessage("weeklySetCardsRefresh", {
          setName: getLocalizedString(set.names, "en") ?? set.id,
        }),
      })
      .returning();

    await enqueueSetCardsSync(job.id, set.id);
    enqueued += 1;
  }

  console.log(
    `[catalog] Weekly refresh: metadata updated, ${enqueued} set card job(s) enqueued`,
  );
}
