"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/components/i18n-provider";

const STORAGE_KEY = "tennis-onboarded";

const POINTS = [
  { titleKey: "onboard.level", descKey: "onboard.levelDesc" },
  { titleKey: "onboard.score", descKey: "onboard.scoreDesc" },
  { titleKey: "onboard.analyze", descKey: "onboard.analyzeDesc" },
  { titleKey: "onboard.history", descKey: "onboard.historyDesc" },
] as const;

function alreadyOnboarded(): boolean {
  try {
    if (typeof window === "undefined") return true;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("zq_onboarded") === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

function markOnboarded() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Product intro for 涨球乐 — four selling points (约球 / 多打球 pitch, not 动作).
 * Shown on the login page (LoginView) and again in the app shell for first open.
 * Mini program native login can mark storage / pass ?zq_onboarded=1 to skip a second show.
 */
export function Onboarding() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!alreadyOnboarded()) setOpen(true);
  }, []);

  function dismiss() {
    markOnboarded();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      data-onboarding="true"
    >
      <div className="max-h-[min(92vh,720px)] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark size={32} className="size-8 shrink-0" />
            <p className="truncate text-lg font-bold text-foreground">{t("brand")}</p>
          </div>
          <LanguageSwitch compact />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">{t("onboard.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("onboard.lead")}</p>
        <ol className="mt-5 space-y-3">
          {POINTS.map((point, index) => (
            <li key={point.titleKey} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t(point.titleKey)}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(point.descKey)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" data-onboard-action="skip" onClick={dismiss}>
            {t("onboard.skip")}
          </Button>
          <Button type="button" data-onboard-action="start" onClick={dismiss}>
            {t("onboard.start")}
          </Button>
        </div>
      </div>
    </div>
  );
}
