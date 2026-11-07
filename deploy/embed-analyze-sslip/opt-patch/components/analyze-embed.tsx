"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

/** Live tennis analyze UI (GPU / uvicorn stack). */
export const ANALYZE_EMBED_URL = "https://tennis.47.93.203.28.sslip.io/";

function buildSrc(jobId?: string | null) {
  const base = ANALYZE_EMBED_URL;
  const job = (jobId || "").trim();
  if (!job) return base;
  const url = new URL(base);
  url.searchParams.set("job", job);
  return url.toString();
}

/**
 * Analyze tab surface: full-bleed iframe of the sslip tennis analyze UI.
 * Sits inside AppShell (top brand bar + bottom tabs).
 */
export function AnalyzeEmbed({ jobId }: { jobId?: string }) {
  const search = useSearchParams();
  const src = useMemo(() => {
    const fromQuery = search?.get("job");
    return buildSrc(jobId || fromQuery);
  }, [jobId, search]);

  return (
    <div
      data-page="analysis"
      data-analysis-screen="embed"
      data-analyze-embed="sslip"
      className="relative h-[calc(100dvh-3.5rem-4rem)] w-full overflow-hidden bg-[#07110c]"
    >
      <iframe
        title="网球挥拍测评"
        src={src}
        className="h-full w-full border-0"
        allow="camera; microphone; fullscreen; clipboard-read; clipboard-write; autoplay"
        referrerPolicy="no-referrer-when-downgrade"
        data-analyze-iframe="true"
        data-analyze-src={src}
      />
    </div>
  );
}
