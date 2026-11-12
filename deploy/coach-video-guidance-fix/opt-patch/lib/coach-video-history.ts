/**
 * Persist coach「视频指导」results across soft nav / remount.
 * Messages used to live only in React state — leave during analyze cleared them.
 */

import type { CoachDrill } from "@/lib/eight-techniques";

export type StoredVideoGuidanceMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  drill?: CoachDrill | null;
  kind: "video-guidance";
  jobId?: string;
  at: number;
};

const KEY = "tennis-coach-video-guidance-v1";
const MAX = 20;

function canUseStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readVideoGuidanceHistory(): StoredVideoGuidanceMessage[] {
  if (!canUseStore()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredVideoGuidanceMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && m.kind === "video-guidance" && typeof m.text === "string");
  } catch {
    return [];
  }
}

export function writeVideoGuidanceHistory(messages: StoredVideoGuidanceMessage[]) {
  if (!canUseStore()) return;
  try {
    const trimmed = messages.slice(-MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event("tennis-coach-video-guidance"));
  } catch {
    /* ignore quota */
  }
}

export function appendVideoGuidancePair(pair: {
  userText: string;
  aiText: string;
  drill?: CoachDrill | null;
  jobId?: string;
}) {
  const at = Date.now();
  const next = [
    ...readVideoGuidanceHistory(),
    {
      id: `u-${at}`,
      role: "user" as const,
      text: pair.userText,
      kind: "video-guidance" as const,
      jobId: pair.jobId,
      at,
    },
    {
      id: `c-${at}`,
      role: "coach" as const,
      text: pair.aiText,
      drill: pair.drill || null,
      kind: "video-guidance" as const,
      jobId: pair.jobId,
      at,
    },
  ];
  writeVideoGuidanceHistory(next);
  return next;
}

export function clearVideoGuidanceHistory() {
  if (!canUseStore()) return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("tennis-coach-video-guidance"));
  } catch {
    /* ignore */
  }
}
