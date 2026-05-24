import { NextResponse } from "next/server";
import {
  getDefaultCondition,
  getPricePreference,
  getSetting,
  getUiLanguage,
  setSetting,
} from "@/lib/settings";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";
import { isUiLocale } from "@/lib/i18n/locale";
import { isCardCondition } from "@/lib/utils";

export async function GET() {
  try {
    const pricePreference = await getPricePreference();
    return NextResponse.json({
      pricePreference,
      defaultCondition: await getDefaultCondition(),
      uiLanguage: await getUiLanguage(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SETTINGS_LOAD_FAILED" },
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

    const uiLanguage = await getUiLanguage();
    const response = NextResponse.json({
      pricePreference: await getPricePreference(),
      defaultCondition: await getDefaultCondition(),
      uiLanguage,
    });

    if (body.uiLanguage && isUiLocale(body.uiLanguage)) {
      response.cookies.set(UI_LANGUAGE_COOKIE, body.uiLanguage, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "SETTINGS_SAVE_FAILED" },
      { status: 500 },
    );
  }
}
