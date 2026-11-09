import { Suspense } from "react";
import { AnalysisJobDeeplink } from "@/components/analysis-job-deeplink";
import { AnalysisView } from "@/components/analysis-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "New video analysis", zh: "新建分析" });
}

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<AnalysisView />}>
      <AnalysisJobDeeplink>
        <AnalysisView />
      </AnalysisJobDeeplink>
    </Suspense>
  );
}
