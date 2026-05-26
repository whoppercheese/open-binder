import { NextResponse } from "next/server";
import {
  createCustomCollection,
  createSetCollection,
  listCollections,
} from "@/lib/collections.server";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const items = await listCollections(locale);
    return NextResponse.json({ items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTIONS_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const body = await request.json();
    const { type, setId, name } = body;

    if (type === "set") {
      if (!setId || typeof setId !== "string") {
        return NextResponse.json(
          { errorCode: "SET_ID_REQUIRED" },
          { status: 400 },
        );
      }

      const result = await createSetCollection(
        setId,
        locale,
        typeof name === "string" ? name : undefined,
      );

      if ("error" in result) {
        const status =
          result.error === "SET_NOT_FOUND"
            ? 404
            : result.error === "SET_NOT_SYNCED" ||
                result.error === "SET_HAS_NO_CARDS"
              ? 400
              : 400;
        return NextResponse.json({ errorCode: result.error }, { status });
      }

      return NextResponse.json(
        { collection: result.collection },
        { status: 201 },
      );
    }

    if (type === "custom") {
      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { errorCode: "NAME_REQUIRED" },
          { status: 400 },
        );
      }

      const result = await createCustomCollection(name);
      if ("error" in result) {
        return NextResponse.json({ errorCode: result.error }, { status: 400 });
      }

      return NextResponse.json(
        { collection: result.collection },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { errorCode: "INVALID_COLLECTION_TYPE" },
      { status: 400 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "COLLECTION_CREATE_FAILED" },
      { status: 500 },
    );
  }
}
