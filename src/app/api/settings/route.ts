import { NextResponse } from "next/server";
import {
  getDefaultCondition,
  getPricePreference,
  getSetting,
  setSetting,
} from "@/lib/settings";
import { isCardCondition } from "@/lib/utils";

export async function GET() {
  try {
    const pricePreference = await getPricePreference();
    return NextResponse.json({
      pricePreference,
      defaultCondition: await getDefaultCondition(),
      uiLanguage: await getSetting("ui_language", "de"),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (body.pricePreference === "trend" || body.pricePreference === "low") {
      await setSetting("price_preference", body.pricePreference);
    }

    if (body.uiLanguage === "de" || body.uiLanguage === "en") {
      await setSetting("ui_language", body.uiLanguage);
    }

    if (
      typeof body.defaultCondition === "string" &&
      isCardCondition(body.defaultCondition)
    ) {
      await setSetting("default_condition", body.defaultCondition);
    }

    return NextResponse.json({
      pricePreference: await getPricePreference(),
      defaultCondition: await getDefaultCondition(),
      uiLanguage: await getSetting("ui_language", "de"),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
