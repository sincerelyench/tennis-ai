import { CoachStrokeLibraryView } from "@/components/coach-stroke-library-view";

export const metadata = {
  title: "动作库 · 涨球",
  description: "掌球教练的动作讲解与示范视频",
};

/** Coach-owned stroke library. Wire into coach mobile nav next to 学员分析 / 消息. */
export default function CoachLibraryPage() {
  return <CoachStrokeLibraryView locale="zh" coachId="poppy" />;
}
