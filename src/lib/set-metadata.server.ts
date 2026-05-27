import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { mergeLocalized } from "@/lib/catalog-languages";
import { setImageExists } from "@/lib/image-storage";
import { getUiLanguage } from "@/lib/settings";
import { syncSetImages } from "@/lib/set-images";
import {
  fetchSetAllLangs,
  mergeSetLocalizedFields,
  pickSetImageDetails,
  type TcgdexSetDetail,
  type TcgdexSetSummary,
} from "@/lib/tcgdex";

type UpsertSetOptions = {
  summary?: TcgdexSetSummary;
  syncImages?: "always" | "if-missing" | "never";
  mergeExistingNames?: boolean;
  skipDbUpdateIfExists?: boolean;
};

function shouldSyncImages(
  setId: string,
  mode: UpsertSetOptions["syncImages"],
): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  return !setImageExists(setId, "logo");
}

async function upsertSetFromTcgdex(
  setId: string,
  options: UpsertSetOptions = {},
): Promise<{ ensured: boolean; detail?: TcgdexSetDetail }> {
  const {
    summary,
    syncImages = "if-missing",
    mergeExistingNames = false,
    skipDbUpdateIfExists = false,
  } = options;

  const existing = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
    columns: { id: true, names: true, seriesNames: true },
  });

  const needsImages = shouldSyncImages(setId, syncImages);

  if (existing && skipDbUpdateIfExists && !needsImages) {
    return { ensured: true };
  }

  const details = await fetchSetAllLangs(setId);
  if (details.size === 0) {
    return { ensured: !!existing };
  }

  const { names, seriesNames, seriesId, detail } = mergeSetLocalizedFields(
    details,
    summary,
  );
  const { deDetail, enDetail } = pickSetImageDetails(details, detail);
  const catalogLang = await getUiLanguage();
  const imageDetail =
    catalogLang === "de"
      ? (details.get("de") ?? deDetail)
      : (details.get("en") ?? enDetail);

  if (needsImages) {
    await syncSetImages(imageDetail, enDetail);
  }

  if (existing && skipDbUpdateIfExists) {
    return { ensured: true, detail };
  }

  const finalNames = mergeExistingNames
    ? mergeLocalized(existing?.names ?? {}, names)
    : names;
  const finalSeriesNames = mergeExistingNames
    ? mergeLocalized(existing?.seriesNames ?? {}, seriesNames)
    : seriesNames;

  await db
    .insert(sets)
    .values({
      id: detail.id,
      names: finalNames,
      seriesId,
      seriesNames: finalSeriesNames,
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
        names: finalNames,
        seriesId,
        seriesNames: finalSeriesNames,
        releaseDate: detail.releaseDate ?? null,
        logoUrl: detail.logo ?? null,
        symbolUrl: detail.symbol ?? null,
        officialCode: detail.abbreviation?.official ?? null,
        cardCountTotal: detail.cardCount?.total ?? 0,
        cardCountOfficial: detail.cardCount?.official ?? 0,
        updatedAt: new Date(),
      },
    });

  return { ensured: true, detail };
}

export async function ensureSetMetadata(setId: string): Promise<boolean> {
  const result = await upsertSetFromTcgdex(setId, {
    syncImages: "if-missing",
    mergeExistingNames: false,
    skipDbUpdateIfExists: true,
  });
  return result.ensured;
}

export async function upsertSetMetadataFromSummary(
  summary: TcgdexSetSummary,
): Promise<TcgdexSetDetail> {
  const result = await upsertSetFromTcgdex(summary.id, {
    summary,
    syncImages: "always",
    mergeExistingNames: true,
    skipDbUpdateIfExists: false,
  });

  if (!result.detail) {
    throw new Error(`Failed to upsert set metadata for ${summary.id}`);
  }

  return result.detail;
}
