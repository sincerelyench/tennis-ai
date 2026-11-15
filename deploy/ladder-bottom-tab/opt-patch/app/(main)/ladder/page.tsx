import { FriendsView } from "@/components/friends-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Ladder", zh: "排行榜" });
}

export default function LadderPage() {
  return <FriendsView surface="ladder" />;
}
