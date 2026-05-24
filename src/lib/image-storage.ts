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

export function cardImageExists(cardId: string): boolean {
  return existsSync(getCardImageAbsolutePath(cardId));
}

export function setImageExists(setId: string, kind: SetImageKind): boolean {
  return (
    existsSync(getSetImageAbsolutePath(setId, kind)) ||
    existsSync(getSetPlaceholderAbsolutePath(setId, kind))
  );
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
  const filePath = getCardImageAbsolutePath(cardId);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
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