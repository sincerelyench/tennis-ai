/**
 * Analysis / report / filming-example hook for 涨球.
 *
 * Default platform demos = famous stars (Sabalenka, Djokovic, …), HD Bilibili first.
 * Coach-uploaded demos ONLY when the player selected a published coach that has
 * their own library video for that stroke.
 *
 * Display name default: 涨球教练 / Zhangqiu Coach (never 掌球 / Poppy / 东东).
 */

import {
  type CoachStrokeEntry,
  coachPromptForStroke,
} from "@/lib/coach-stroke-library";
import {
  DEFAULT_COACH_DISPLAY_EN,
  DEFAULT_COACH_DISPLAY_ZH,
  resolvePlatformDemo,
  type PlatformDemoResult,
} from "@/lib/platform-demo";
import { starDemoForStroke } from "@/lib/star-demos";

export const DEFAULT_COACH_ID = "poppy";
export const DEFAULT_COACH_NAME_ZH = DEFAULT_COACH_DISPLAY_ZH;
export const DEFAULT_COACH_NAME_EN = DEFAULT_COACH_DISPLAY_EN;

const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";

export type CoachLibraryDemo = {
  videoUrl: string;
  embedUrl: string;
  watchUrl: string;
  prompt: string;
  title: string;
  credit: string;
  creditZh: string;
  creditEn: string;
  fromCoach: boolean;
  source: "star" | "coach";
  platform: string;
  coachId: string;
  coachName: string;
  starNameKey?: string;
  qualityHint?: string;
};

function normalizeDisplayName(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return DEFAULT_COACH_NAME_ZH;
  if (/poppy|东东|dongdong|掌球/i.test(raw)) return DEFAULT_COACH_NAME_ZH;
  return raw;
}

function readSelectedCoachClient(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(PLAYER_SELECTED_COACH_KEY) || "").trim();
  } catch {
    return "";
  }
}

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

async function fetchCoachPublishStatus(coachId: string): Promise<{
  published: boolean;
  displayName: string;
}> {
  try {
    const res = await fetch(
      `/tennis/api/coaches?coachId=${encodeURIComponent(coachId)}&published=1`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      const coach = data.coach || (Array.isArray(data.coaches) ? data.coaches.find((c: { coachId: string }) => c.coachId === coachId) : null);
      if (coach) {
        return {
          published: String(coach.status || "").toLowerCase() === "published" || Boolean(coach.published),
          displayName: normalizeDisplayName(coach.displayName),
        };
      }
    }
  } catch {
    /* ignore */
  }
  // Default roster coach is always "available" but has no library videos → stars.
  return {
    published: coachId === DEFAULT_COACH_ID,
    displayName: coachId === DEFAULT_COACH_ID ? DEFAULT_COACH_NAME_ZH : DEFAULT_COACH_NAME_ZH,
  };
}

async function fetchLibraryEntry(
  strokeId: string,
  coachId: string,
): Promise<CoachStrokeEntry | null> {
  try {
    const res = await fetch(
      `/tennis/api/coach/library?coachId=${encodeURIComponent(coachId)}&strokeId=${encodeURIComponent(strokeId)}`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.entry as CoachStrokeEntry | null) || null;
  } catch {
    return null;
  }
}

function toDemo(result: PlatformDemoResult, coachId: string, coachName: string): CoachLibraryDemo {
  const star = result.star || starDemoForStroke(result.strokeId);
  return {
    videoUrl: result.embedUrl,
    embedUrl: result.embedUrl,
    watchUrl: result.watchUrl,
    prompt: result.prompt,
    title: result.source === "coach" ? result.credit : `${star.nameZh} · ${star.strokeLabelZh}`,
    credit: result.creditZh || result.credit,
    creditZh: result.creditZh,
    creditEn: result.creditEn,
    fromCoach: result.source === "coach",
    source: result.source,
    platform: result.platform,
    coachId,
    coachName,
    starNameKey: star.nameKey,
    qualityHint: result.qualityHint,
  };
}

/**
 * Correct-form / 拍摄示例 / refs resolver.
 * Always returns a playable demo — stars by default.
 */
export async function fetchCoachLibraryDemo(
  strokeId: string,
  coachId?: string,
): Promise<CoachLibraryDemo> {
  const id = coachId || (await resolveAnalysisCoachId());
  const { published, displayName } = await fetchCoachPublishStatus(id);
  const entry = await fetchLibraryEntry(strokeId, id);

  // Only treat as "selected published coach library" when published AND has video.
  // Bare default 涨球教练 with empty library → stars (not muddy /tennis/examples).
  const selectedPublished = published && Boolean(entry?.videoUrl?.trim());

  const resolved = resolvePlatformDemo(
    strokeId,
    {
      coachId: id,
      coachName: displayName,
      selectedPublished,
      videoUrl: entry?.videoUrl,
      prompt: entry?.prompt,
      title: entry?.title,
    },
    true,
  );

  return toDemo(resolved, id, displayName);
}

/** Sync helper for filming example widgets (no network). Always stars. */
export function platformStarDemoSync(strokeId: string): CoachLibraryDemo {
  const resolved = resolvePlatformDemo(strokeId, null, true);
  return toDemo(resolved, DEFAULT_COACH_ID, DEFAULT_COACH_NAME_ZH);
}

export async function analysisPromptInjection(strokeId: string, coachId?: string): Promise<string> {
  const id = coachId || (await resolveAnalysisCoachId());
  const base = coachPromptForStroke(strokeId, id);
  if (!base) return "";
  return base
    .replace(/Poppy|东东|Dongdong|掌球教练/gi, DEFAULT_COACH_NAME_ZH)
    .replace(/Zhangqiu Coach/gi, DEFAULT_COACH_NAME_EN);
}
