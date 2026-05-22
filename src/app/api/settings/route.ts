import { NextResponse } from "next/server";
import { getPricePreference, getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  try {
    const pricePreference = await getPricePreference();
    return NextResponse.json({
      pricePreference,
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

    return NextResponse.json({
      pricePreference: await getPricePreference(),
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
