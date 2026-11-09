import type { Metadata } from "next";
import { JourneyView } from "@/components/journey-view";

export const metadata: Metadata = { title: "成长旅程" };

export default function JourneyPage() {
  return <JourneyView />;
}
