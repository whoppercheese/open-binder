import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CARD_IMAGES_SUBDIR = "cards";

export function getImageStorageRoot(): string {
  return (
    process.env.IMAGE_STORAGE_PATH ??
    path.join(process.cwd(), "storage", "images")
  );
}

function sanitizeCardId(cardId: string): string {
  return cardId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getCardImageRelativePath(cardId: string): string {
  return path.join(CARD_IMAGES_SUBDIR, `${sanitizeCardId(cardId)}.webp`);
}

export function getCardImageAbsolutePath(cardId: string): string {
  return path.join(getImageStorageRoot(), getCardImageRelativePath(cardId));
}

export function cardImageExists(cardId: string): boolean {
  return existsSync(getCardImageAbsolutePath(cardId));
}

export async function ensureImageStorageDir() {
  await mkdir(path.join(getImageStorageRoot(), CARD_IMAGES_SUBDIR), {
    recursive: true,
  });
}

export async function cacheCardImage(
  cardId: string,
  sourceUrl: string,
): Promise<boolean> {
  const destination = getCardImageAbsolutePath(cardId);

  if (existsSync(destination)) {
    return true;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return false;
    }

    await ensureImageStorageDir();
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

export async function readCardImage(cardId: string): Promise<Buffer | null> {
  const filePath = getCardImageAbsolutePath(cardId);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFile(filePath);
}