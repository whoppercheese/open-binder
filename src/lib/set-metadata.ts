import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import {
  hasSetImageOnDisk,
  syncSetImages,
} from "@/lib/set-images";
import {
  CATALOG_FALLBACK_LANG,
  fetchSetAllLangs,
  mergeSetLocalizedFields,
} from "@/lib/tcgdex";

export async function ensureSetMetadata(setId: string): Promise<boolean> {
  const existing = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
    columns: { id: true },
  });
  const needsImages = !hasSetImageOnDisk(setId);

  if (existing && !needsImages) {
    return true;
  }

  const details = await fetchSetAllLangs(setId);
  if (details.size === 0) {
    return !!existing;
  }

  const { names, seriesNames, seriesId, detail } =
    mergeSetLocalizedFields(details);
  const enDetail = details.get(CATALOG_FALLBACK_LANG) ?? detail;
  const deDetail = details.get("de") ?? enDetail;

  if (needsImages) {
    await syncSetImages(deDetail, enDetail);
  }

  if (existing) {
    return true;
  }

  await db
    .insert(sets)
    .values({
      id: detail.id,
      names,
      seriesId,
      seriesNames,
      releaseDate: detail.releaseDate ?? null,
      logoUrl: detail.logo ?? null,
      symbolUrl: detail.symbol ?? null,
      officialCode: detail.abbreviation?.official ?? null,
      cardCountTotal: detail.cardCount?.total ?? 0,
      cardCountOfficial: detail.cardCount?.official ?? 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sets.id,
      set: {
        names,
        seriesId,
        seriesNames,
        releaseDate: detail.releaseDate ?? null,
        logoUrl: detail.logo ?? null,
        symbolUrl: detail.symbol ?? null,
        officialCode: detail.abbreviation?.official ?? null,
        cardCountTotal: detail.cardCount?.total ?? 0,
        cardCountOfficial: detail.cardCount?.official ?? 0,
        updatedAt: new Date(),
      },
    });

  return true;
}
