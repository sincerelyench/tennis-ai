/**
 * Lightweight hook for analysis / report flows.
 * Call when a coach is selected and a stroke is known.
 *
 * Example (report correct-form video):
 *   const demo = await fetchCoachLibraryDemo(strokeId, coachId);
 *   if (demo?.videoUrl) use demo.videoUrl + credit 涨球教练
 *   if (demo?.prompt) append to analysis system prompt
 */

import {
  COACH_DISPLAY_NAME_ZH,
  type CoachStrokeEntry,
  coachPromptForStroke,
  resolveCoachDemo,
} from "@/lib/coach-stroke-library";

export type CoachLibraryDemo = {
  videoUrl: string;
  prompt: string;
  title: string;
  credit: string;
  fromCoach: boolean;
};

export async function fetchCoachLibraryDemo(
  strokeId: string,
  coachId = "poppy",
): Promise<CoachLibraryDemo | null> {
  try {
    const res = await fetch(
      `/tennis/api/coach/library?coachId=${encodeURIComponent(coachId)}&strokeId=${encodeURIComponent(strokeId)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      const entry = data.entry as CoachStrokeEntry | null;
      if (entry && (entry.videoUrl || entry.prompt)) {
        return {
          videoUrl: entry.videoUrl || "",
          prompt: entry.prompt || "",
          title: entry.title || "",
          credit: entry.videoUrl
            ? `${COACH_DISPLAY_NAME_ZH}${entry.title ? ` · ${entry.title}` : ""}`
            : "",
          fromCoach: Boolean(entry.videoUrl || entry.prompt),
        };
      }
    }
  } catch {
    /* fall through to local */
  }
  const local = resolveCoachDemo(strokeId, "", coachId);
  if (!local.fromCoach && !local.prompt) return null;
  return {
    videoUrl: local.url,
    prompt: local.prompt,
    title: "",
    credit: local.credit,
    fromCoach: local.fromCoach || Boolean(local.prompt),
  };
}

export function analysisPromptInjection(strokeId: string, coachId = "poppy"): string {
  return coachPromptForStroke(strokeId, coachId);
}
