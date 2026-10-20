"use client";

import { CoachStrokeLibraryView } from "@/components/coach-stroke-library-view";
import { CoachPublishPanel } from "@/components/coach-publish-panel";

/**
 * Coach workspace: stroke library + publish/train CTAs.
 * Route: /tennis/library
 * Default persona: 掌球教练 (not Poppy / 东东).
 */
export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-background pb-16" data-page="coach-library-publish">
      <CoachStrokeLibraryView locale="zh" coachId="poppy" mirrorLocal />
      <CoachPublishPanel locale="zh" coachId="poppy" />
    </main>
  );
}
