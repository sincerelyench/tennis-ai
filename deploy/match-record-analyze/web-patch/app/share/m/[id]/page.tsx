import type { Metadata } from "next";
import { MatchShareView } from "@/components/match-share-view";
import { readMatchShare } from "@/lib/match-share-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const share = readMatchShare(id);
  return {
    title: share ? `${share.match.title} · 涨球分享` : "比赛分享 · 涨球",
    description: share
      ? `${share.ownerLabel} 的比赛分析（无需会员即可查看）`
      : "涨球比赛分析分享",
  };
}

export default async function MatchSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = readMatchShare(id);
  return <MatchShareView share={share} />;
}
