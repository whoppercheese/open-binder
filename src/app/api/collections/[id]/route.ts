import { NextResponse } from "next/server";
import {
  deleteCollectionById,
  getCollectionById,
  getCollectionProgress,
  updateCollectionMeta,
} from "@/lib/collections.server";
import {
  getCollectionCoverFields,
  setCollectionCover,
} from "@/lib/collection-cover.server";
import { getRequestTranslator } from "@/lib/i18n/server";
import { getLocalizedString } from "@/lib/catalog-languages";
import { UNKNOWN_LABEL } from "@/lib/localized-names";
import { db } from "@/db/client";
import { sets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    const collection = await getCollectionById(id);

    if (!collection) {
      return NextResponse.json(
        { errorCode: "COLLECTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const progress = await getCollectionProgress(collection);
    let setName: string | null = null;

    if (collection.setId) {
      const set = await db.query.sets.findFirst({
        where: eq(sets.id, collection.setId),
      });
      setName = set
        ? (getLocalizedString(set.names, locale) ?? UNKNOWN_LABEL)
        : null;
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        imageUrl: collection.imageUrl,
        ...getCollectionCoverFields(collection),
        type: collection.type,
        setId: collection.setId,
        setName,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      },
      progress,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { locale } = getRequestTranslator(request);
    const { id } = await context.params;
    const body = await request.json();

    if ("coverCardId" in body) {
      const coverCardId =
        body.coverCardId == null
          ? null
          : typeof body.coverCardId === "string"
            ? body.coverCardId.trim()
            : undefined;

      if (coverCardId === undefined) {
        return NextResponse.json(
          { errorCode: "INVALID_COVER_CARD_ID" },
          { status: 400 },
        );
      }

      const result = await setCollectionCover(
        id,
        coverCardId === "" ? null : coverCardId,
        locale,
      );

      if ("error" in result) {
        const status =
          result.error === "COLLECTION_NOT_FOUND"
            ? 404
            : result.error === "CARD_NOT_IN_COLLECTION"
              ? 400
              : 400;
        return NextResponse.json({ errorCode: result.error }, { status });
      }

      return NextResponse.json({
        collection: {
          id: result.collection.id,
          name: result.collection.name,
          imageUrl: result.collection.imageUrl,
          ...getCollectionCoverFields(result.collection),
          type: result.collection.type,
          setId: result.collection.setId,
          createdAt: result.collection.createdAt.toISOString(),
          updatedAt: result.collection.updatedAt.toISOString(),
        },
      });
    }

    const result = await updateCollectionMeta(id, { name: body.name });

    if ("error" in result) {
      const status = result.error === "COLLECTION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ errorCode: result.error }, { status });
    }

    return NextResponse.json({ collection: result.collection });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const deleted = await deleteCollectionById(id);

    if (!deleted) {
      return NextResponse.json(
        { errorCode: "COLLECTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_DELETE_FAILED" },
      { status: 500 },
    );
  }
}
