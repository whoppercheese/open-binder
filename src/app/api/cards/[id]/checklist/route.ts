import { NextResponse } from "next/server";
import {
  addCardToChecklists,
  getCardChecklistMembership,
} from "@/lib/checklist-membership.server";
import { getLocaleFromRequest } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const locale = getLocaleFromRequest(request);
    const result = await getCardChecklistMembership(id, locale);

    if ("error" in result) {
      const status = result.error === "CARD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "CHECKLIST_MEMBERSHIP_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rawIds = body.collectionIds;
    const collectionIds = Array.isArray(rawIds)
      ? rawIds.filter((value: unknown): value is string => typeof value === "string")
      : [];

    const result = await addCardToChecklists(id, collectionIds);

    if ("error" in result) {
      const status =
        result.error === "CARD_NOT_FOUND" ||
        result.error === "COLLECTION_NOT_FOUND"
          ? 404
          : 400;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "CHECKLIST_ADD_FAILED" },
      { status: 500 },
    );
  }
}
