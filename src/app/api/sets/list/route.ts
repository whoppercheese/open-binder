import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/lib/i18n/server";
import { getSetListEntries } from "@/lib/sets-list.server";

export async function GET(request: Request) {
  const { t } = getRequestTranslator(request);
  try {
    const sets = await getSetListEntries();
    return NextResponse.json({ sets });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("errors.api.setsListLoadFailed") },
      { status: 500 },
    );
  }
}
