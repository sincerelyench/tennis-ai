import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalysisJobDeeplink } from "@/components/analysis-job-deeplink";
import { AnalysisView } from "@/components/analysis-view";

export const metadata: Metadata = { title: "New video analysis" };

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<AnalysisView />}>
      <AnalysisJobDeeplink>
        <AnalysisView />
      </AnalysisJobDeeplink>
    </Suspense>
  );
}
