import { cookies } from "next/headers";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";
import {
  DEFAULT_LOCALE,
  isUiLocale,
  type UiLocale,
} from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/messages";

export { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";

export async function getRequestLocale(): Promise<UiLocale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(UI_LANGUAGE_COOKIE)?.value;
  if (fromCookie && isUiLocale(fromCookie)) {
    return fromCookie;
  }
  return DEFAULT_LOCALE;
}

export function getLocaleFromRequest(request: Request): UiLocale {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("lang");
  if (fromQuery && isUiLocale(fromQuery)) {
    return fromQuery;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${UI_LANGUAGE_COOKIE}=([^;]+)`),
  );
  if (match?.[1] && isUiLocale(match[1])) {
    return match[1];
  }

  return DEFAULT_LOCALE;
}

export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return { locale, t: createTranslator(locale) };
}

export function getRequestTranslator(request: Request) {
  const locale = getLocaleFromRequest(request);
  return { locale, t: createTranslator(locale) };
}
