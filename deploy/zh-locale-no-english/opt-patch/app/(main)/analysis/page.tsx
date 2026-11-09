import { Suspense } from "react";
import { AnalysisJobDeeplink } from "@/components/analysis-job-deeplink";
import { ReportsView } from "@/components/reports-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Video analysis", zh: "视频分析" });
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<ReportsView variant="analysis" />}>
      <AnalysisJobDeeplink>
        <ReportsView variant="analysis" />
      </AnalysisJobDeeplink>
    </Suspense>
  );
}
