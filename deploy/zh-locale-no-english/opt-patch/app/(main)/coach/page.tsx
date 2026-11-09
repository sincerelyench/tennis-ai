import { CoachView } from "@/components/coach-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "AI coach", zh: "AI 教练" });
}

export default function CoachPage() {
  return <CoachView />;
}
