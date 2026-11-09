import { HelpView } from "@/components/help-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Help", zh: "帮助" });
}

export default function HelpPage() {
  return <HelpView />;
}
