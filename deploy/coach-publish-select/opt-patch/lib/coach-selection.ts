/**
 * Player-side coach selection. Only published coaches appear in the picker.
 * Selected coachId drives analysis / coach-tab demos + prompts.
 */

import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  normalizeDisplayName,
  type CoachPublishProfile,
  readSelectedCoachClient,
  writeSelectedCoachClient,
} from "@/lib/coach-publish";

export type PublishedCoachCard = {
  coachId: string;
  displayName: string;
  styleTagline: string;
  publishedAt: string | null;
  libraryStrokeCount: number;
};

export function toPublishedCard(p: CoachPublishProfile): PublishedCoachCard {
  return {
    coachId: p.coachId,
    displayName: normalizeDisplayName(p.displayName) || DEFAULT_COACH_NAME_ZH,
    styleTagline: p.styleTagline || "",
    publishedAt: p.publishedAt,
    libraryStrokeCount: p.libraryStrokeCount,
  };
}

/** Resolve which coach materials analysis should use. */
export function resolveActiveCoachId(preferred?: string | null): string {
  if (preferred && preferred.trim()) return preferred.trim();
  return readSelectedCoachClient() || DEFAULT_COACH_ID;
}

export function selectCoach(coachId: string): string {
  return writeSelectedCoachClient(coachId);
}

export async function fetchPublishedCoaches(): Promise<PublishedCoachCard[]> {
  try {
    const res = await fetch("/tennis/api/coaches?published=1", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const list = (data.coaches || []) as PublishedCoachCard[];
      return list.map((c) => ({
        ...c,
        displayName: normalizeDisplayName(c.displayName),
      }));
    }
  } catch {
    /* local fallback */
  }
  try {
    const { listPublishedClient } = await import("@/lib/coach-publish");
    return listPublishedClient().map(toPublishedCard);
  } catch {
    return [];
  }
}

export async function fetchSelectedCoach(): Promise<{ coachId: string; coach: PublishedCoachCard | null }> {
  try {
    const res = await fetch("/tennis/api/player/coach", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return {
        coachId: data.coachId || DEFAULT_COACH_ID,
        coach: data.coach
          ? { ...data.coach, displayName: normalizeDisplayName(data.coach.displayName) }
          : null,
      };
    }
  } catch {
    /* fall through */
  }
  const coachId = readSelectedCoachClient();
  return { coachId, coach: null };
}

export async function putSelectedCoach(coachId: string): Promise<string> {
  const id = selectCoach(coachId);
  try {
    await fetch("/tennis/api/player/coach", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coachId: id }),
    });
  } catch {
    /* local already written */
  }
  return id;
}
