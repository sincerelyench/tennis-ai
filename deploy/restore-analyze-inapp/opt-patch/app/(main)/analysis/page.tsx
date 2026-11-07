import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalysisJobDeeplink } from "@/components/analysis-job-deeplink";
import { ReportsView } from "@/components/reports-view";

export const metadata: Metadata = { title: "Video analysis" };

export default function AnalysisPage() {
  return (
    <Suspense fallback={<ReportsView variant="analysis" />}>
      <AnalysisJobDeeplink>
        <ReportsView variant="analysis" />
      </AnalysisJobDeeplink>
    </Suspense>
  );
}
