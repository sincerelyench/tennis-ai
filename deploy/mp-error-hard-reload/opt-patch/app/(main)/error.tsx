"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

const CHUNK_RE = /ChunkLoadError|Loading chunk|Failed to load chunk/i;
const RELOAD_FLAG = "zq_chunk_hard_reload";

/** ZQ-164c: WeChat web-view soft-nav after rebuild sticks on reset()-only error.tsx. */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const msg = `${error?.name || ""} ${error?.message || ""}`;
    if (!CHUNK_RE.test(msg)) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [error]);

  function hardRetry() {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* ignore */
    }
    // Full document reload so web-view picks current BUILD chunks (reset() alone stays stuck).
    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8" data-main-error="1">
      <Alert variant="destructive">
        <AlertTitle>{t("error.pageTitle")}</AlertTitle>
        <AlertDescription>{t("error.pageDesc")}</AlertDescription>
      </Alert>
      <Button type="button" data-error-retry="hard" onClick={hardRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
