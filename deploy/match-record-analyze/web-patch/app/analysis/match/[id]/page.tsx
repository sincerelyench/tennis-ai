import type { Metadata } from "next";
import { MatchDetailView } from "@/components/match-detail-view";

export const metadata: Metadata = { title: "比赛回放 · 涨球" };

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetailView matchId={id} />;
}
