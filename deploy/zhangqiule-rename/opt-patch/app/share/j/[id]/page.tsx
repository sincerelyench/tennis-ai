import type { Metadata } from "next";
import { JourneySharePageView } from "@/components/journey-share-page";
import { readJourneyShare } from "@/lib/journey-share-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const share = readJourneyShare(id);
  return {
    title: share ? `${share.strokeLabel} journey` : "Shared journey",
    description: share ? `${share.name}'s ${share.strokeLabel} growth journey on 涨球乐.` : "Shared 涨球乐 growth journey.",
  };
}

export default async function JourneySharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = readJourneyShare(id);
  return <JourneySharePageView share={share} />;
}
