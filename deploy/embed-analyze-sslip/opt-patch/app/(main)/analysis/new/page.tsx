import type { Metadata } from "next";
import { AnalysisView } from "@/components/analysis-view";

export const metadata: Metadata = { title: "New video analysis" };

export default function NewAnalysisPage() {
  return <AnalysisView />;
}
