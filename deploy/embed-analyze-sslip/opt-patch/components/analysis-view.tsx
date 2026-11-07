"use client";

import { Suspense } from "react";
import { AnalyzeEmbed } from "@/components/analyze-embed";

/**
 * Analyze surface is the embedded sslip tennis UI (iframe).
 * Kept as AnalysisView so /analysis/new and older imports keep working.
 */
export function AnalysisView() {
  return (
    <Suspense
      fallback={
        <div
          data-page="analysis"
          data-analysis-screen="embed"
          data-analyze-embed="sslip"
          className="flex h-[calc(100dvh-3.5rem-4rem)] items-center justify-center bg-[#07110c] text-sm text-white/70"
        >
          Loading analyze…
        </div>
      }
    >
      <AnalyzeEmbed />
    </Suspense>
  );
}
