import { JourneyView } from "@/components/journey-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Growth journey", zh: "成长旅程" });
}

export default function JourneyPage() {
  return <JourneyView />;
}
