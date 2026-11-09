import { FriendsView } from "@/components/friends-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Play", zh: "约球" });
}

export default function FriendsPage() {
  return <FriendsView />;
}
