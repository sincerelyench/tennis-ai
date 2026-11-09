import { CoachStudentsView } from "@/components/coach-students-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Student analyses", zh: "学员分析" });
}

export default function StudentsPage() {
  return <CoachStudentsView />;
}
