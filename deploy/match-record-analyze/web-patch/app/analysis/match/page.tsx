import type { Metadata } from "next";
import { MatchRecordView } from "@/components/match-record-view";

export const metadata: Metadata = { title: "比赛录制分析 · 涨球" };

export default function MatchRecordPage() {
  return <MatchRecordView />;
}
