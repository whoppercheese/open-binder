import { NextResponse } from "next/server";
import {
  addCardsToChecklists,
  getBulkChecklistMembership,
} from "@/lib/checklist-membership.server";
import { ensureCardsInCatalog } from "@/lib/ensure-cards.server";
import { getRequestTranslator } from "@/lib/i18n/server";

function parseCardIds(searchParams: URLSearchParams): string[] {
  const raw = searchParams.get("cardIds")?.trim();
  if (!raw) {
    return [];
  }

  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

function parseCardIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const raw = (body as { cardIds?: unknown }).cardIds;
  if (!Array.isArray(raw)) {
    return [];
  }

  return [...new Set(raw.filter((value): value is string => typeof value === "string"))];
}

function parseCollectionIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const raw = (body as { collectionIds?: unknown }).collectionIds;
  if (!Array.isArray(raw)) {
    return [];
  }

  return [
    ...new Set(raw.filter((value): value is string => typeof value === "string")),
  ];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardIds = parseCardIds(searchParams);

    if (cardIds.length === 0) {
      return NextResponse.json(
        { errorCode: "CARD_IDS_REQUIRED" },
        { status: 400 },
      );
    }

    const result = await getBulkChecklistMembership(cardIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "CHECKLIST_MEMBERSHIP_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const body = await request.json();
    const cardIds = parseCardIdsFromBody(body);
    const collectionIds = parseCollectionIdsFromBody(body);

    if (cardIds.length === 0) {
      return NextResponse.json(
        { errorCode: "CARD_IDS_REQUIRED" },
        { status: 400 },
      );
    }

    if (collectionIds.length === 0) {
      const ensureResult = await ensureCardsInCatalog(cardIds, locale);
      if (ensureResult.failed.length > 0 && ensureResult.synced.length === 0) {
        return NextResponse.json(
          {
            errorCode: "CARDS_ENSURE_FAILED",
            failed: ensureResult.failed,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        synced: ensureResult.synced,
        failed: ensureResult.failed,
      });
    }

    const ensureResult = await ensureCardsInCatalog(cardIds, locale);
    const ensuredIds = new Set(ensureResult.synced);

    if (ensureResult.failed.length > 0) {
      const addableIds = cardIds.filter((id) => ensuredIds.has(id));
      if (addableIds.length === 0) {
        return NextResponse.json(
          {
            errorCode: "CARDS_ENSURE_FAILED",
            failed: ensureResult.failed,
          },
          { status: 502 },
        );
      }

      const addResult = await addCardsToChecklists(addableIds, collectionIds);
      if ("error" in addResult) {
        const status =
          addResult.error === "COLLECTION_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ errorCode: addResult.error }, { status });
      }

      return NextResponse.json({
        added: addResult.added,
        skipped: addResult.skipped,
        failed: ensureResult.failed,
        checklistCounts: Object.fromEntries(addResult.checklistCounts),
      });
    }

    const result = await addCardsToChecklists(cardIds, collectionIds);

    if ("error" in result) {
      const status =
        result.error === "COLLECTION_NOT_FOUND" ||
        result.error === "CARDS_NOT_FOUND"
          ? 404
          : 400;
      return NextResponse.json(
        {
          errorCode: result.error,
          missingCardIds:
            "missingCardIds" in result ? result.missingCardIds : undefined,
        },
        { status },
      );
    }

    return NextResponse.json({
      added: result.added,
      skipped: result.skipped,
      failed: [],
      checklistCounts: Object.fromEntries(result.checklistCounts),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "BULK_CHECKLIST_ADD_FAILED" },
      { status: 500 },
    );
  }
}
