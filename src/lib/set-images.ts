import { existsSync } from "node:fs";
import type { SetImageKind } from "@/lib/image-paths";
import {
  cacheSetImage,
  getSetImageAbsolutePath,
  getSetPlaceholderAbsolutePath,
  removeSetPlaceholderImage,
  resolveSetPlaceholderLabel,
  writeSetPlaceholderImage,
} from "@/lib/image-storage";
import type { TcgdexSetDetail } from "@/lib/tcgdex";

async function syncSetImageKind(
  setId: string,
  kind: SetImageKind,
  sourceUrl: string | null | undefined,
  placeholderLabel: string,
) {
  if (sourceUrl) {
    await cacheSetImage(setId, kind, sourceUrl);
    if (!existsSync(getSetImageAbsolutePath(setId, kind))) {
      await removeSetPlaceholderImage(setId, kind);
    }
    return;
  }

  await writeSetPlaceholderImage(setId, kind, placeholderLabel);
}

export async function syncSetImages(
  detail: TcgdexSetDetail,
  enDetail: TcgdexSetDetail,
) {
  const logoUrl = detail.logo ?? enDetail.logo ?? null;
  const symbolUrl = detail.symbol ?? enDetail.symbol ?? null;
  const placeholderBase = {
    officialCode: detail.abbreviation?.official,
    name: detail.name,
  };

  await syncSetImageKind(
    detail.id,
    "logo",
    logoUrl,
    resolveSetPlaceholderLabel(
      placeholderBase.officialCode,
      placeholderBase.name,
      "logo",
    ),
  );
  await syncSetImageKind(
    detail.id,
    "symbol",
    symbolUrl,
    resolveSetPlaceholderLabel(
      placeholderBase.officialCode,
      placeholderBase.name,
      "symbol",
    ),
  );
}

export function hasSetImageOnDisk(
  setId: string,
  kind: SetImageKind = "logo",
): boolean {
  return (
    existsSync(getSetImageAbsolutePath(setId, kind)) ||
    existsSync(getSetPlaceholderAbsolutePath(setId, kind))
  );
}
