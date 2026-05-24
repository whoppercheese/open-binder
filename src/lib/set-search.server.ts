import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { UiLocale } from "@/lib/i18n/locale";
import { buildSetTokenMatchSql } from "@/lib/search";

export async function resolveMatchingSetIds(
  token: string,
  locale: UiLocale,
  limit = 10,
): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT s.id
    FROM sets s
    WHERE ${buildSetTokenMatchSql(token, locale)}
    ORDER BY s.release_date DESC NULLS LAST
    LIMIT ${limit}
  `);

  return rows.map((row) => row.id);
}
