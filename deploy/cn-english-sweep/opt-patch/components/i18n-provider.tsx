"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  detectBrowserLocale,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE,
  translate,
  type Locale,
} from "@/lib/i18n/translate";

const Ctx = createContext<{
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (next: Locale) => void;
} | null>(null);

function persist(next: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE, next);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || "zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE);
      if (isLocale(saved)) {
        setLocaleState(saved);
        persist(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    if (!initialLocale) {
      const detected = detectBrowserLocale();
      setLocaleState(detected);
      persist(detected);
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persist(next);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
