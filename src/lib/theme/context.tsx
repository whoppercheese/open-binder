"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { COLOR_THEME_COOKIE } from "@/lib/theme/constants";
import {
  applyThemeTokensToDocument,
  themeTokensToStyle,
} from "@/lib/theme/css-vars";
import { getIsOnline } from "@/lib/offline/connection-state";
import {
  DEFAULT_COLOR_THEME,
  normalizeColorTheme,
  THEME_DEFINITIONS,
  type ColorThemeId,
} from "@/lib/theme/themes";

function readThemeFromCookie(): ColorThemeId {
  if (typeof document === "undefined") {
    return DEFAULT_COLOR_THEME;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COLOR_THEME_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return value ? normalizeColorTheme(value) : DEFAULT_COLOR_THEME;
}

function setThemeCookie(themeId: ColorThemeId) {
  document.cookie = `${COLOR_THEME_COOKIE}=${themeId};path=/;max-age=31536000;samesite=lax`;
}

function applyThemeToDocument(themeId: ColorThemeId) {
  document.documentElement.dataset.theme = themeId;
  applyThemeTokensToDocument(THEME_DEFINITIONS[themeId].tokens);
}

type ThemeContextValue = {
  colorTheme: ColorThemeId;
  setColorTheme: (themeId: ColorThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ColorThemeId;
}) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(initialTheme);

  useEffect(() => {
    let cancelled = false;
    applyThemeToDocument(colorTheme);

    if (!navigator.onLine || !getIsOnline()) {
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { colorTheme?: string };
        if (cancelled) return;
        const next = data.colorTheme
          ? normalizeColorTheme(data.colorTheme)
          : readThemeFromCookie();
        setColorThemeState(next);
        applyThemeToDocument(next);
        setThemeCookie(next);
      } catch {
        // keep SSR/cookie theme
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setColorTheme = useCallback((themeId: ColorThemeId) => {
    setColorThemeState(themeId);
    applyThemeToDocument(themeId);
    setThemeCookie(themeId);

    if (!navigator.onLine || !getIsOnline()) {
      return;
    }

    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorTheme: themeId }),
    });
  }, []);

  const value = useMemo(
    () => ({ colorTheme, setColorTheme }),
    [colorTheme, setColorTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useColorTheme must be used within ThemeProvider");
  }
  return context;
}

export { themeTokensToStyle };
