import { NextResponse } from "next/server";
import {
  getColorTheme,
  getDefaultCondition,
  getUiLanguage,
  setSetting,
} from "@/lib/settings";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";
import { isUiLocale } from "@/lib/i18n/locale";
import { COLOR_THEME_COOKIE } from "@/lib/theme/constants";
import { isColorThemeId } from "@/lib/theme/themes";
import { isCardCondition } from "@/lib/utils";

export async function GET() {
  try {
    return NextResponse.json({
      defaultCondition: await getDefaultCondition(),
      uiLanguage: await getUiLanguage(),
      colorTheme: await getColorTheme(),
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

    if (body.uiLanguage === "de" || body.uiLanguage === "en") {
      await setSetting("ui_language", body.uiLanguage);
    }

    if (
      typeof body.defaultCondition === "string" &&
      isCardCondition(body.defaultCondition)
    ) {
      await setSetting("default_condition", body.defaultCondition);
    }

    if (typeof body.colorTheme === "string" && isColorThemeId(body.colorTheme)) {
      await setSetting("color_theme", body.colorTheme);
    }

    const uiLanguage = await getUiLanguage();
    const response = NextResponse.json({
      defaultCondition: await getDefaultCondition(),
      uiLanguage,
      colorTheme: await getColorTheme(),
    });

    if (body.uiLanguage && isUiLocale(body.uiLanguage)) {
      response.cookies.set(UI_LANGUAGE_COOKIE, body.uiLanguage, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    if (body.colorTheme && isColorThemeId(body.colorTheme)) {
      response.cookies.set(COLOR_THEME_COOKIE, body.colorTheme, {
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
