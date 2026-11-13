"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  ANDROID_APK_URL,
  readApkHintDismissed,
  shouldSuggestAndroidApk,
  writeApkHintDismissed,
} from "@/lib/android-apk";
import { cn } from "@/lib/utils";

/** Once-dismissible soft banner for Android phone browsers (not ZhangqiuAndroid shell). */
export function AndroidApkBanner({ className }: { className?: string }) {
  const { t } = useI18n();
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setEligible(shouldSuggestAndroidApk());
    setDismissed(readApkHintDismissed());
  }, []);

  if (!eligible || dismissed) return null;

  return (
    <div
      data-apk-hint-banner="true"
      className={cn(
        "mx-auto w-full max-w-md border-b border-border bg-muted/70 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("apkHint.bannerTitle")}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("apkHint.bannerLead")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={ANDROID_APK_URL}
              data-apk-hint-download="banner"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              {t("apkHint.download")}
            </a>
            <button
              type="button"
              data-apk-hint-dismiss="true"
              className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              onClick={() => {
                writeApkHintDismissed();
                setDismissed(true);
              }}
            >
              {t("apkHint.dismiss")}
            </button>
          </div>
        </div>
        <button
          type="button"
          data-apk-hint-dismiss-icon="true"
          aria-label={t("apkHint.dismiss")}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
          onClick={() => {
            writeApkHintDismissed();
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Subtle persistent download entry (login / 我的). Hidden in APK shell & non-Android. */
export function AndroidApkLink({
  className,
  variant = "text",
}: {
  className?: string;
  variant?: "text" | "row";
}) {
  const { t } = useI18n();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    setEligible(shouldSuggestAndroidApk());
  }, []);

  if (!eligible) return null;

  if (variant === "row") {
    return (
      <a
        href={ANDROID_APK_URL}
        data-apk-hint-link="profile"
        className={cn(
          "flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <Download className="size-5 text-primary" aria-hidden />
          <span className="text-sm text-foreground">{t("apkHint.profileLabel")}</span>
        </div>
        <span className="text-xs font-medium text-primary">{t("apkHint.download")}</span>
      </a>
    );
  }

  return (
    <a
      href={ANDROID_APK_URL}
      data-apk-hint-link="inline"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline",
        className,
      )}
    >
      <Download className="size-3.5 shrink-0" aria-hidden />
      {t("apkHint.link")}
    </a>
  );
}
