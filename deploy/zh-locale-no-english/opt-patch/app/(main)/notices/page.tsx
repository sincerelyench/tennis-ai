import { NoticesView } from "@/components/notices-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Notifications", zh: "通知" });
}

export default function NoticesPage() {
  return <NoticesView />;
}
