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
import {
  DEFAULT_LOCALE,
  isUiLocale,
  type UiLocale,
} from "@/lib/i18n/locale";
import { getIsOnline } from "@/lib/offline/connection-state";
import { createTranslator, type TranslateFn } from "@/lib/i18n/messages";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";

function readLocaleFromCookie(): UiLocale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${UI_LANGUAGE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return value && isUiLocale(value) ? value : DEFAULT_LOCALE;
}

type LocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: TranslateFn;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function syncDocumentLang(locale: UiLocale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

function setLocaleCookie(locale: UiLocale) {
  document.cookie = `${UI_LANGUAGE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: UiLocale;
}) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    syncDocumentLang(locale);

    if (!navigator.onLine) {
      setReady(true);
      return;
    }

    if (!getIsOnline()) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { uiLanguage?: string };
        if (cancelled) return;
        const next =
          data.uiLanguage && isUiLocale(data.uiLanguage)
            ? data.uiLanguage
            : readLocaleFromCookie();
        setLocaleState(next);
        setLocaleCookie(next);
        syncDocumentLang(next);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    setLocaleCookie(next);
    syncDocumentLang(next);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  if (!ready) {
    return (
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslations() {
  return useLocale().t;
}

export function apiUrl(path: string, locale: UiLocale): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}lang=${locale}`;
}
