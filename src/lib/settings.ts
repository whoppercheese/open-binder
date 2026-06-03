import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import {
  DEFAULT_COLOR_THEME,
  normalizeColorTheme,
  type ColorThemeId,
} from "@/lib/theme/themes";
import { normalizeLegacyCondition, type CardCondition } from "@/lib/utils";

export async function getSetting(
  key: string,
  defaultValue: string,
): Promise<string> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, key),
  });
  return row?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getDefaultCondition(): Promise<CardCondition> {
  const value = await getSetting("default_condition", "nm");
  return normalizeLegacyCondition(value) ?? "nm";
}

export async function getUiLanguage(): Promise<"en" | "de"> {
  const value = await getSetting("ui_language", "en");
  return value === "de" ? "de" : "en";
}

export async function getColorTheme(): Promise<ColorThemeId> {
  const value = await getSetting("color_theme", DEFAULT_COLOR_THEME);
  return normalizeColorTheme(value);
}
