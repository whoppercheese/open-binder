import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { isCardCondition, type CardCondition } from "@/lib/utils";

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

export type PricePreference = "trend" | "low";

export async function getPricePreference(): Promise<PricePreference> {
  const value = await getSetting("price_preference", "trend");
  return value === "low" ? "low" : "trend";
}

export async function getDefaultCondition(): Promise<CardCondition> {
  const value = await getSetting("default_condition", "nm");
  return isCardCondition(value) ? value : "nm";
}

export function pickPrice(
  price: { trendEur?: string | null; lowEur?: string | null } | null | undefined,
  preference: PricePreference,
): number | null {
  if (!price) return null;
  const raw =
    preference === "low"
      ? (price.lowEur ?? price.trendEur)
      : (price.trendEur ?? price.lowEur);
  if (raw == null) return null;
  const num = parseFloat(raw);
  return Number.isNaN(num) ? null : num;
}
