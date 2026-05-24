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
import { createTranslator, type TranslateFn } from "@/lib/i18n/messages";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/constants";

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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { uiLanguage?: string };
        if (cancelled) return;
        const next =
          data.uiLanguage && isUiLocale(data.uiLanguage)
            ? data.uiLanguage
            : DEFAULT_LOCALE;
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
