import { NextResponse } from "next/server";
import { getChecklistCountsForCardIds } from "@/lib/checklist-membership.server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids")?.trim() ?? "";
    const cardIds = idsParam
      ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    const counts = await getChecklistCountsForCardIds(cardIds);

    return NextResponse.json({
      counts: Object.fromEntries(counts),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "CHECKLIST_COUNTS_FAILED" },
      { status: 500 },
    );
  }
}
