/**
 * Analysis / report hook — uses the **player-selected published coach**.
 * Prefer selected coachId; fall back to default roster id (display 掌球教练).
 *
 * Example:
 *   const coachId = await resolveAnalysisCoachId();
 *   const demo = await fetchCoachLibraryDemo(strokeId, coachId);
 */

import {
  COACH_DISPLAY_NAME_ZH,
  type CoachStrokeEntry,
  coachPromptForStroke,
  resolveCoachDemo,
} from "@/lib/coach-stroke-library";
import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  normalizeDisplayName,
  readSelectedCoachClient,
} from "@/lib/coach-publish";

export type CoachLibraryDemo = {
  videoUrl: string;
  prompt: string;
  title: string;
  credit: string;
  fromCoach: boolean;
  coachId: string;
  coachName: string;
};

export async function resolveAnalysisCoachId(): Promise<string> {
  try {
    const res = await fetch("/tennis/api/player/coach", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.coach?.coachId) return String(data.coach.coachId);
      if (data.coachId) return String(data.coachId);
    }
  } catch {
    /* local */
  }
  return readSelectedCoachClient() || DEFAULT_COACH_ID;
}

async function resolveCoachName(coachId: string): Promise<string> {
  try {
    const res = await fetch(
      `/tennis/api/coaches?coachId=${encodeURIComponent(coachId)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      return normalizeDisplayName(data.coach?.displayName) || DEFAULT_COACH_NAME_ZH;
    }
  } catch {
    /* ignore */
  }
  return coachId === DEFAULT_COACH_ID ? DEFAULT_COACH_NAME_ZH : COACH_DISPLAY_NAME_ZH;
}

export async function fetchCoachLibraryDemo(
  strokeId: string,
  coachId?: string,
): Promise<CoachLibraryDemo | null> {
  const id = coachId || (await resolveAnalysisCoachId());
  const coachName = await resolveCoachName(id);
  try {
    const res = await fetch(
      `/tennis/api/coach/library?coachId=${encodeURIComponent(id)}&strokeId=${encodeURIComponent(strokeId)}`,
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
            ? `${coachName}${entry.title ? ` · ${entry.title}` : ""}`
            : "",
          fromCoach: Boolean(entry.videoUrl || entry.prompt),
          coachId: id,
          coachName,
        };
      }
    }
  } catch {
    /* fall through to local */
  }
  const local = resolveCoachDemo(strokeId, "", id);
  if (!local.fromCoach && !local.prompt) return null;
  return {
    videoUrl: local.url,
    prompt: local.prompt,
    title: "",
    credit: local.credit || (local.fromCoach ? coachName : ""),
    fromCoach: local.fromCoach || Boolean(local.prompt),
    coachId: id,
    coachName,
  };
}

export async function analysisPromptInjection(strokeId: string, coachId?: string): Promise<string> {
  const id = coachId || (await resolveAnalysisCoachId());
  const base = coachPromptForStroke(strokeId, id);
  if (!base) return "";
  // Ensure credit uses 掌球教练 default naming, never Poppy/东东.
  return base.replace(/Poppy|东东|Dongdong/gi, DEFAULT_COACH_NAME_ZH);
}
