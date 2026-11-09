import { NotificationsView } from "@/components/notifications-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Notification settings", zh: "通知设置" });
}

export default function NotificationsPage() {
  return <NotificationsView />;
}
