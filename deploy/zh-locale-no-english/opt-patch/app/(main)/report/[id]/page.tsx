import { ReportView } from "@/components/report-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Analysis report", zh: "分析报告" });
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const raw = Array.isArray(query.from) ? query.from[0] : query.from;
  const from = raw === "reports" ? "reports" : "analysis";
  return <ReportView reportId={id} from={from} />;
}
