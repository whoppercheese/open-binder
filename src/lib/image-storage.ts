import { copyFile, existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, sets } from "@/db/schema";
import {
  resolveTcgdexImageLocale,
  type SetImageKind,
} from "@/lib/image-paths";
import { extractSetIdFromCardId } from "@/lib/card-id";
import type { UiLocale } from "@/lib/i18n/locale";
import {
  fetchCard,
  fetchCardWithFallback,
  resolveCardImageCandidates,
  resolveTcgdexAssetUrl,
  type TcgdexCard,
} from "@/lib/tcgdex";
import { getTcgdexClient } from "@/lib/tcgdex-client";

const copyFileAsync = promisify(copyFile);

const CARD_IMAGES_SUBDIR = "cards";
const SET_IMAGES_SUBDIR = "sets";
const COLLECTION_COVERS_SUBDIR = "collection-covers";

export type { SetImageKind };

export function getImageStorageRoot(): string {
  return (
    process.env.IMAGE_STORAGE_PATH ??
    path.join(process.cwd(), "storage", "images")
  );
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getCardImageFileName(cardId: string): string {
  return `${sanitizeId(cardId)}.webp`;
}

function resolveCardImageSetId(cardId: string, setId?: string): string {
  return setId ?? extractSetIdFromCardId(cardId);
}

/** cards/{setId}/{lang}/{cardId}.webp */
export function getCardImageRelativePath(
  cardId: string,
  lang: UiLocale,
  setId?: string,
): string {
  const resolvedSetId = resolveCardImageSetId(cardId, setId);
  return path.join(
    CARD_IMAGES_SUBDIR,
    sanitizeId(resolvedSetId),
    lang,
    getCardImageFileName(cardId),
  );
}

export function getCardImageAbsolutePath(
  cardId: string,
  lang: UiLocale,
  setId?: string,
): string {
  return path.join(
    getImageStorageRoot(),
    getCardImageRelativePath(cardId, lang, setId),
  );
}

/** Pre-set/lang layout: cards/{cardId}-{lang}.webp or cards/{cardId}.webp */
function getLegacyFlatCardImageAbsolutePath(
  cardId: string,
  lang?: UiLocale,
): string {
  const base = sanitizeId(cardId);
  const fileName = lang ? `${base}-${lang}.webp` : `${base}.webp`;
  return path.join(getImageStorageRoot(), CARD_IMAGES_SUBDIR, fileName);
}

export function getSetImageRelativePath(
  setId: string,
  kind: SetImageKind,
): string {
  return path.join(SET_IMAGES_SUBDIR, `${sanitizeId(setId)}-${kind}.webp`);
}

export function getSetImageAbsolutePath(
  setId: string,
  kind: SetImageKind,
): string {
  return path.join(getImageStorageRoot(), getSetImageRelativePath(setId, kind));
}

export function getCollectionCoverRelativePath(collectionId: string): string {
  return path.join(
    COLLECTION_COVERS_SUBDIR,
    `${sanitizeId(collectionId)}.webp`,
  );
}

export function getCollectionCoverAbsolutePath(collectionId: string): string {
  return path.join(
    getImageStorageRoot(),
    getCollectionCoverRelativePath(collectionId),
  );
}

export function getSetPlaceholderRelativePath(
  setId: string,
  kind: SetImageKind,
): string {
  return path.join(SET_IMAGES_SUBDIR, `${sanitizeId(setId)}-${kind}.svg`);
}

export function getSetPlaceholderAbsolutePath(
  setId: string,
  kind: SetImageKind,
): string {
  return path.join(
    getImageStorageRoot(),
    getSetPlaceholderRelativePath(setId, kind),
  );
}

export type StoredSetImage = {
  buffer: Buffer;
  contentType: "image/webp" | "image/svg+xml";
};

export function cardImageExists(cardId: string, lang?: UiLocale): boolean {
  return getCardImageServePaths(cardId, lang).some((filePath) =>
    existsSync(filePath),
  );
}

function getCardImageLocalePaths(cardId: string, lang: UiLocale): string[] {
  const setId = extractSetIdFromCardId(cardId);
  return [
    getCardImageAbsolutePath(cardId, lang, setId),
    getLegacyFlatCardImageAbsolutePath(cardId, lang),
  ];
}

function getCardImageFallbackServePaths(
  cardId: string,
  lang: UiLocale,
): string[] {
  const setId = extractSetIdFromCardId(cardId);
  const paths: string[] = [];
  if (lang !== "en") {
    paths.push(getCardImageAbsolutePath(cardId, "en", setId));
    paths.push(getLegacyFlatCardImageAbsolutePath(cardId, "en"));
  }
  paths.push(getLegacyFlatCardImageAbsolutePath(cardId));
  return paths;
}

/** Disk lookup: exact locale, EN fallback, then legacy flat files. */
function getCardImageServePaths(cardId: string, lang?: UiLocale): string[] {
  if (!lang) {
    return [getLegacyFlatCardImageAbsolutePath(cardId)];
  }

  return [
    ...getCardImageLocalePaths(cardId, lang),
    ...getCardImageFallbackServePaths(cardId, lang),
  ];
}

async function readCardImageForLocale(
  cardId: string,
  locale: UiLocale,
): Promise<Buffer | null> {
  for (const filePath of getCardImageLocalePaths(cardId, locale)) {
    if (existsSync(filePath)) {
      return readFile(filePath);
    }
  }
  return null;
}

async function readCardImageForServe(
  cardId: string,
  requestedLocale: UiLocale,
): Promise<Buffer | null> {
  const exact = await readCardImageForLocale(cardId, requestedLocale);
  if (exact) {
    return exact;
  }

  for (const filePath of getCardImageFallbackServePaths(
    cardId,
    requestedLocale,
  )) {
    if (existsSync(filePath)) {
      return readFile(filePath);
    }
  }
  return null;
}

export type EnsureCardImageOptions = {
  force?: boolean;
  /** Live TCGdex card from sync — skips DB lookup for URL candidates. */
  syncContext?: {
    card: TcgdexCard;
    seriesId: string;
    setId: string;
  };
};

export type EnsureCardImageResult = {
  buffer: Buffer | null;
  imageUrl: string | null;
};

const ensureCardImageInflight = new Map<string, Promise<EnsureCardImageResult>>();

async function resolveSeriesIdForSet(
  setId: string,
  locale: UiLocale,
): Promise<string | null> {
  const row = await db.query.sets.findFirst({
    where: eq(sets.id, setId),
    columns: { seriesId: true },
  });
  if (row) {
    return row.seriesId;
  }

  const remote = await getTcgdexClient(locale).set.get(setId);
  return remote?.serie?.id ?? null;
}

async function fetchTcgdexCardForImage(
  cardId: string,
  preferredLang: UiLocale,
): Promise<TcgdexCard | null> {
  try {
    if (preferredLang === "de") {
      const { card } = await fetchCardWithFallback(cardId, "de", "en");
      return card;
    }

    return await fetchCard(cardId, "en");
  } catch {
    return null;
  }
}

async function resolveImageCandidatesFromTcgdex(
  cardId: string,
  preferredLang: UiLocale,
): Promise<readonly string[] | null> {
  const card = await fetchTcgdexCardForImage(cardId, preferredLang);
  if (!card) {
    return null;
  }

  const setId = card.set?.id ?? extractSetIdFromCardId(cardId);
  const seriesId =
    card.set?.serie?.id ?? (await resolveSeriesIdForSet(setId, preferredLang));
  if (!seriesId) {
    return card.image ? [resolveTcgdexAssetUrl(card.image)] : null;
  }

  return resolveCardImageCandidates(card, seriesId, setId, preferredLang);
}

async function resolveImageCandidates(
  cardId: string,
  preferredLang: UiLocale,
  syncContext?: EnsureCardImageOptions["syncContext"],
): Promise<readonly string[] | null> {
  if (syncContext) {
    return resolveCardImageCandidates(
      syncContext.card,
      syncContext.seriesId,
      syncContext.setId,
      preferredLang,
    );
  }

  const row = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
    columns: { number: true, imageUrl: true, setId: true },
  });
  if (row) {
    const seriesId = await resolveSeriesIdForSet(row.setId, preferredLang);
    if (seriesId) {
      const stub: TcgdexCard = {
        id: cardId,
        localId: row.number,
        name: "",
        image: row.imageUrl ?? undefined,
        set: { id: row.setId, name: "" },
      };

      return resolveCardImageCandidates(
        stub,
        seriesId,
        row.setId,
        preferredLang,
      );
    }
  }

  return resolveImageCandidatesFromTcgdex(cardId, preferredLang);
}

async function ensureCardImageInternal(
  cardId: string,
  requestedLocale: UiLocale,
  options?: EnsureCardImageOptions,
): Promise<EnsureCardImageResult> {
  if (!options?.force) {
    const exact = await readCardImageForLocale(cardId, requestedLocale);
    if (exact) {
      return { buffer: exact, imageUrl: null };
    }
  }

  const candidates = await resolveImageCandidates(
    cardId,
    requestedLocale,
    options?.syncContext,
  );
  if (!candidates || candidates.length === 0) {
    const fallback = await readCardImageForServe(cardId, requestedLocale);
    return { buffer: fallback, imageUrl: null };
  }

  const setId =
    options?.syncContext?.setId ?? extractSetIdFromCardId(cardId);
  const { cached, imageUrl } = await cacheCardImageFromCandidates(
    cardId,
    candidates,
    requestedLocale,
    { force: options?.force, setId },
  );

  if (!cached) {
    const fallback = await readCardImageForServe(cardId, requestedLocale);
    return { buffer: fallback, imageUrl: null };
  }

  const buffer = await readCardImageForServe(cardId, requestedLocale);
  return { buffer, imageUrl };
}

/** Read from disk (with EN fallback) or fetch from TCGdex, cache, and serve. */
export async function ensureCardImage(
  cardId: string,
  requestedLocale: UiLocale,
  options?: EnsureCardImageOptions,
): Promise<EnsureCardImageResult> {
  const inflightKey = `${cardId}:${requestedLocale}:${options?.force ? "1" : "0"}`;
  const pending = ensureCardImageInflight.get(inflightKey);
  if (pending) {
    return pending;
  }

  const work = ensureCardImageInternal(cardId, requestedLocale, options).finally(
    () => {
      ensureCardImageInflight.delete(inflightKey);
    },
  );
  ensureCardImageInflight.set(inflightKey, work);
  return work;
}

export function setImageExists(setId: string, kind: SetImageKind): boolean {
  return (
    existsSync(getSetImageAbsolutePath(setId, kind)) ||
    existsSync(getSetPlaceholderAbsolutePath(setId, kind))
  );
}

export function collectionCoverExists(collectionId: string): boolean {
  return existsSync(getCollectionCoverAbsolutePath(collectionId));
}

export function resolveSetImageKind(setId: string): SetImageKind | null {
  if (setImageExists(setId, "logo")) return "logo";
  if (setImageExists(setId, "symbol")) return "symbol";
  return null;
}

async function ensureCardImageStorageDir(setId: string, lang: UiLocale) {
  await mkdir(
    path.join(
      getImageStorageRoot(),
      CARD_IMAGES_SUBDIR,
      sanitizeId(setId),
      lang,
    ),
    { recursive: true },
  );
}

export async function ensureImageStorageDir() {
  await mkdir(path.join(getImageStorageRoot(), CARD_IMAGES_SUBDIR), {
    recursive: true,
  });
  await mkdir(path.join(getImageStorageRoot(), SET_IMAGES_SUBDIR), {
    recursive: true,
  });
  await mkdir(path.join(getImageStorageRoot(), COLLECTION_COVERS_SUBDIR), {
    recursive: true,
  });
}

async function cacheImage(
  destination: string,
  sourceUrl: string,
  options?: { force?: boolean },
): Promise<boolean> {
  if (!options?.force && existsSync(destination)) {
    const existing = await readFile(destination);
    if (isWebpBuffer(existing)) {
      return true;
    }
    await unlink(destination);
  } else if (options?.force && existsSync(destination)) {
    await unlink(destination);
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return false;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!isWebpBuffer(buffer)) {
      return false;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return true;
  } catch {
    return false;
  }
}

function isWebpBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export async function cacheCardImage(
  cardId: string,
  sourceUrl: string,
  lang: UiLocale,
  options?: { force?: boolean; setId?: string },
): Promise<boolean> {
  const setId = resolveCardImageSetId(cardId, options?.setId);
  await ensureCardImageStorageDir(setId, lang);
  return cacheImage(
    getCardImageAbsolutePath(cardId, lang, setId),
    sourceUrl,
    options,
  );
}

/** Try each URL until one caches; stores under the locale encoded in the URL. */
export async function cacheCardImageFromCandidates(
  cardId: string,
  urls: readonly string[],
  preferredLang: UiLocale,
  options?: { force?: boolean; setId?: string },
): Promise<{ cached: boolean; imageUrl: string | null }> {
  const setId = resolveCardImageSetId(cardId, options?.setId);
  for (const url of urls) {
    const storedLang = resolveTcgdexImageLocale(url) ?? preferredLang;
    const cached = await cacheCardImage(cardId, url, storedLang, {
      ...options,
      setId,
    });
    if (cached) {
      for (const legacyPath of [
        getLegacyFlatCardImageAbsolutePath(cardId),
        getLegacyFlatCardImageAbsolutePath(cardId, "de"),
        getLegacyFlatCardImageAbsolutePath(cardId, "en"),
      ]) {
        if (existsSync(legacyPath)) {
          await unlink(legacyPath);
        }
      }

      return { cached: true, imageUrl: url };
    }
  }

  return { cached: false, imageUrl: urls[0] ?? null };
}

export async function cacheSetImage(
  setId: string,
  kind: SetImageKind,
  sourceUrl: string,
): Promise<boolean> {
  const cached = await cacheImage(
    getSetImageAbsolutePath(setId, kind),
    resolveTcgdexAssetUrl(sourceUrl),
  );

  if (cached) {
    const placeholderPath = getSetPlaceholderAbsolutePath(setId, kind);
    if (existsSync(placeholderPath)) {
      await unlink(placeholderPath);
    }
  }

  return cached;
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function placeholderFontSize(label: string, kind: SetImageKind): number {
  const maxSize = kind === "symbol" ? 18 : 22;
  if (label.length <= 2) return maxSize;
  if (label.length === 3) return maxSize - 4;
  return maxSize - 7;
}

export function resolveSetPlaceholderLabel(
  officialCode: string | null | undefined,
  name: string,
  kind: SetImageKind = "logo",
): string {
  const maxLength = kind === "symbol" ? 3 : 4;
  const code = officialCode?.trim();
  if (code) {
    return code.slice(0, maxLength).toUpperCase();
  }

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].slice(0, 1) + words[1].slice(0, 1)).toUpperCase();
  }

  return name.trim().slice(0, maxLength).toUpperCase() || "?";
}

export function buildSetPlaceholderSvg(
  label: string,
  kind: SetImageKind = "logo",
): string {
  const safeLabel = escapeSvgText(label);
  const fontSize = placeholderFontSize(label, kind);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">',
    '<rect width="64" height="64" rx="12" fill="#10131a"/>',
    '<rect x="4" y="4" width="56" height="56" rx="10" fill="#18181b" stroke="#27272a"/>',
    `<text x="32" y="36" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600" fill="#10b981">${safeLabel}</text>`,
    "</svg>",
  ].join("");
}

export async function writeSetPlaceholderImage(
  setId: string,
  kind: SetImageKind,
  label: string,
): Promise<void> {
  if (existsSync(getSetImageAbsolutePath(setId, kind))) {
    return;
  }

  await ensureImageStorageDir();
  await writeFile(
    getSetPlaceholderAbsolutePath(setId, kind),
    buildSetPlaceholderSvg(label, kind),
    "utf8",
  );
}

export async function removeSetPlaceholderImage(
  setId: string,
  kind: SetImageKind,
): Promise<void> {
  const placeholderPath = getSetPlaceholderAbsolutePath(setId, kind);
  if (existsSync(placeholderPath)) {
    await unlink(placeholderPath);
  }
}

export async function deleteCardImage(cardId: string): Promise<void> {
  const setId = extractSetIdFromCardId(cardId);
  const paths = [
    getCardImageAbsolutePath(cardId, "de", setId),
    getCardImageAbsolutePath(cardId, "en", setId),
    getLegacyFlatCardImageAbsolutePath(cardId, "de"),
    getLegacyFlatCardImageAbsolutePath(cardId, "en"),
    getLegacyFlatCardImageAbsolutePath(cardId),
  ];

  for (const filePath of paths) {
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }
}

export async function deleteCollectionCoverImage(
  collectionId: string,
): Promise<void> {
  const filePath = getCollectionCoverAbsolutePath(collectionId);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

export async function readCollectionCoverImage(
  collectionId: string,
): Promise<Buffer | null> {
  const filePath = getCollectionCoverAbsolutePath(collectionId);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFile(filePath);
}

export async function snapshotCollectionCover(
  collectionId: string,
  cardId: string,
  sourceImageUrl?: string | null,
  lang?: UiLocale,
): Promise<boolean> {
  const destination = getCollectionCoverAbsolutePath(collectionId);
  const cardImagePath = getCardImageServePaths(cardId, lang).find((filePath) =>
    existsSync(filePath),
  );

  await ensureImageStorageDir();

  if (cardImagePath) {
    await copyFileAsync(cardImagePath, destination);
    return true;
  }

  if (sourceImageUrl) {
    return cacheImage(destination, resolveTcgdexAssetUrl(sourceImageUrl));
  }

  return false;
}

export async function readCardImage(
  cardId: string,
  lang?: UiLocale,
): Promise<Buffer | null> {
  if (!lang) {
    const legacyPath = getLegacyFlatCardImageAbsolutePath(cardId);
    if (existsSync(legacyPath)) {
      return readFile(legacyPath);
    }
    return null;
  }

  return readCardImageForServe(cardId, lang);
}

export async function readSetImage(
  setId: string,
  kind: SetImageKind,
): Promise<StoredSetImage | null> {
  const webpPath = getSetImageAbsolutePath(setId, kind);
  if (existsSync(webpPath)) {
    return {
      buffer: await readFile(webpPath),
      contentType: "image/webp",
    };
  }

  const svgPath = getSetPlaceholderAbsolutePath(setId, kind);
  if (existsSync(svgPath)) {
    return {
      buffer: await readFile(svgPath),
      contentType: "image/svg+xml",
    };
  }

  return null;
}