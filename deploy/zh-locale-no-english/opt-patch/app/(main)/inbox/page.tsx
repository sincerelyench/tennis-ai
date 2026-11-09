import { CoachInboxView } from "@/components/coach-inbox-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Messages", zh: "消息" });
}

export default function InboxPage() {
  return <CoachInboxView />;
}
