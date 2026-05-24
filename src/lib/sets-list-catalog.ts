import { sql, type SQL } from "drizzle-orm";
import { sets } from "@/db/schema";
import { UI_LOCALES } from "@/lib/i18n/locale";

export function isInSupportedCatalog(
  names: Record<string, string> | null | undefined,
): boolean {
  if (!names) {
    return false;
  }

  return UI_LOCALES.some((locale) => Boolean(names[locale]?.trim()));
}

export function supportedCatalogSetsWhere(): SQL {
  const conditions = UI_LOCALES.map(
    (locale) =>
      sql`nullif(trim(${sets.names}->>${locale}), '') is not null`,
  );

  return sql.join(conditions, sql` or `);
}
