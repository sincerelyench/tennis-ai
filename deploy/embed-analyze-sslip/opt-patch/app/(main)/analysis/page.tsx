import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyzeEmbed } from "@/components/analyze-embed";

export const metadata: Metadata = { title: "Video analysis" };

export default function AnalysisPage() {
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
