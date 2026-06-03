import { cookies } from "next/headers";
import { COLOR_THEME_COOKIE } from "@/lib/theme/constants";
import {
  DEFAULT_COLOR_THEME,
  normalizeColorTheme,
  type ColorThemeId,
} from "@/lib/theme/themes";

export { COLOR_THEME_COOKIE } from "@/lib/theme/constants";

export async function getRequestColorTheme(): Promise<ColorThemeId> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COLOR_THEME_COOKIE)?.value;
  if (fromCookie) {
    return normalizeColorTheme(fromCookie);
  }
  return DEFAULT_COLOR_THEME;
}
