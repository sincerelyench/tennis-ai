/**
 * Coach-owned per-stroke library (讲解文案 + 示范视频).
 * Drop into /opt/tennis-ai/lib/ alongside existing coach opinions / demos helpers.
 *
 * Storage:
 * - Browser: localStorage `tennis-coach-stroke-library-v1` (+ optional blob URLs)
 * - Server: `.data/coach-library.json` via /api/coach/library
 *
 * Coach display name must be 涨球教练 (not Poppy / 东东).
 */

export const COACH_DISPLAY_NAME_ZH = "涨球教练";
export const COACH_DISPLAY_NAME_EN = "Zhangqiu Coach";
export const COACH_STROKE_LIBRARY_KEY = "tennis-coach-stroke-library-v1";

/** Same 8 ids the analyze flow already lists. */
export const COACH_LIBRARY_STROKES = [
  "fh-topspin",
  "fh-slice",
  "fh-volley",
  "bh-topspin",
  "bh-slice",
  "bh-volley",
  "serve",
  "smash",
] as const;

export type CoachLibraryStrokeId = (typeof COACH_LIBRARY_STROKES)[number];

export type CoachStrokeEntry = {
  strokeId: CoachLibraryStrokeId;
  /** Instructional copy / analysis prompt material for this stroke. */
  prompt: string;
  /** Demo video URL (https, blob:, or /tennis/… upload path). */
  videoUrl: string;
  /** Optional short title shown next to the demo. */
  title: string;
  updatedAt: string;
};

export type CoachStrokeLibrary = {
  coachId: string;
  coachName: string;
  entries: Record<string, CoachStrokeEntry>;
  updatedAt: string;
};

export function emptyLibrary(coachId = "poppy"): CoachStrokeLibrary {
  return {
    coachId,
    coachName: COACH_DISPLAY_NAME_ZH,
    entries: {},
    updatedAt: new Date().toISOString(),
  };
}

export function isStrokeId(id: string): id is CoachLibraryStrokeId {
  return (COACH_LIBRARY_STROKES as readonly string[]).includes(id);
}

export function readLibraryClient(coachId = "poppy"): CoachStrokeLibrary {
  if (typeof window === "undefined") return emptyLibrary(coachId);
  try {
    const raw = window.localStorage.getItem(COACH_STROKE_LIBRARY_KEY);
    if (!raw) return emptyLibrary(coachId);
    const parsed = JSON.parse(raw) as CoachStrokeLibrary;
    if (!parsed || typeof parsed !== "object") return emptyLibrary(coachId);
    return {
      ...emptyLibrary(coachId),
      ...parsed,
      coachId: parsed.coachId || coachId,
      coachName: COACH_DISPLAY_NAME_ZH,
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch {
    return emptyLibrary(coachId);
  }
}

export function writeLibraryClient(lib: CoachStrokeLibrary): CoachStrokeLibrary {
  const next: CoachStrokeLibrary = {
    ...lib,
    coachName: COACH_DISPLAY_NAME_ZH,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COACH_STROKE_LIBRARY_KEY, JSON.stringify(next));
  }
  return next;
}

export function upsertEntryClient(
  strokeId: CoachLibraryStrokeId,
  patch: Partial<Pick<CoachStrokeEntry, "prompt" | "videoUrl" | "title">>,
  coachId = "poppy",
): CoachStrokeLibrary {
  const lib = readLibraryClient(coachId);
  const prev = lib.entries[strokeId];
  const entry: CoachStrokeEntry = {
    strokeId,
    prompt: patch.prompt ?? prev?.prompt ?? "",
    videoUrl: patch.videoUrl ?? prev?.videoUrl ?? "",
    title: patch.title ?? prev?.title ?? "",
    updatedAt: new Date().toISOString(),
  };
  lib.entries[strokeId] = entry;
  return writeLibraryClient(lib);
}

export function clearEntryVideoClient(
  strokeId: CoachLibraryStrokeId,
  coachId = "poppy",
): CoachStrokeLibrary {
  return upsertEntryClient(strokeId, { videoUrl: "" }, coachId);
}

/** Prefer logged-in coach library entry when present; else fall back to platform demo URL. */
export function resolveCoachDemo(
  strokeId: string,
  platformDemoUrl: string,
  coachId = "poppy",
): { url: string; credit: string; prompt: string; fromCoach: boolean } {
  const lib = readLibraryClient(coachId);
  const entry = isStrokeId(strokeId) ? lib.entries[strokeId] : undefined;
  if (entry?.videoUrl?.trim()) {
    return {
      url: entry.videoUrl.trim(),
      credit: `${COACH_DISPLAY_NAME_ZH} · ${entry.title || strokeId}`,
      prompt: entry.prompt || "",
      fromCoach: true,
    };
  }
  return {
    url: platformDemoUrl,
    credit: "",
    prompt: entry?.prompt || "",
    fromCoach: false,
  };
}

/** Build a short analysis-prompt injection from coach library text. */
export function coachPromptForStroke(strokeId: string, coachId = "poppy"): string {
  if (!isStrokeId(strokeId)) return "";
  const entry = readLibraryClient(coachId).entries[strokeId];
  const text = entry?.prompt?.trim();
  if (!text) return "";
  return `${COACH_DISPLAY_NAME_ZH} teaching notes for ${strokeId}:\n${text}`;
}
