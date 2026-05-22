import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SetImageKind } from "@/lib/image-paths";
import { resolveTcgdexAssetUrl } from "@/lib/tcgdex";

const CARD_IMAGES_SUBDIR = "cards";
const SET_IMAGES_SUBDIR = "sets";

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

export function getCardImageRelativePath(cardId: string): string {
  return path.join(CARD_IMAGES_SUBDIR, `${sanitizeId(cardId)}.webp`);
}

export function getCardImageAbsolutePath(cardId: string): string {
  return path.join(getImageStorageRoot(), getCardImageRelativePath(cardId));
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

export function cardImageExists(cardId: string): boolean {
  return existsSync(getCardImageAbsolutePath(cardId));
}

export function setImageExists(setId: string, kind: SetImageKind): boolean {
  return existsSync(getSetImageAbsolutePath(setId, kind));
}

export function resolveSetImageKind(setId: string): SetImageKind | null {
  if (setImageExists(setId, "logo")) return "logo";
  if (setImageExists(setId, "symbol")) return "symbol";
  return null;
}

export async function ensureImageStorageDir() {
  await mkdir(path.join(getImageStorageRoot(), CARD_IMAGES_SUBDIR), {
    recursive: true,
  });
  await mkdir(path.join(getImageStorageRoot(), SET_IMAGES_SUBDIR), {
    recursive: true,
  });
}

async function cacheImage(
  destination: string,
  sourceUrl: string,
): Promise<boolean> {
  if (existsSync(destination)) {
    const existing = await readFile(destination);
    if (isWebpBuffer(existing)) {
      return true;
    }
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

    await ensureImageStorageDir();
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
): Promise<boolean> {
  return cacheImage(getCardImageAbsolutePath(cardId), sourceUrl);
}

export async function cacheSetImage(
  setId: string,
  kind: SetImageKind,
  sourceUrl: string,
): Promise<boolean> {
  return cacheImage(
    getSetImageAbsolutePath(setId, kind),
    resolveTcgdexAssetUrl(sourceUrl),
  );
}

export async function readCardImage(cardId: string): Promise<Buffer | null> {
  const filePath = getCardImageAbsolutePath(cardId);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFile(filePath);
}

export async function readSetImage(
  setId: string,
  kind: SetImageKind,
): Promise<Buffer | null> {
  const filePath = getSetImageAbsolutePath(setId, kind);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFile(filePath);
}