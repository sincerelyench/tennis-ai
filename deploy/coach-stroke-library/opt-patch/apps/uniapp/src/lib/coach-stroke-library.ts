/** Uni-app mirror of web lib/coach-stroke-library.ts — keep IDs in sync. */

export const COACH_DISPLAY_NAME_ZH = "掌球教练";
export const COACH_DISPLAY_NAME_EN = "Zhangqiu Coach";
export const COACH_STROKE_LIBRARY_KEY = "tennis-coach-stroke-library-v1";

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
  prompt: string;
  videoUrl: string;
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

function storageGet(key: string): string {
  try {
    // @ts-expect-error uni global in native builds
    if (typeof uni !== "undefined" && uni.getStorageSync) return String(uni.getStorageSync(key) || "");
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key) || "";
  } catch {
    /* ignore */
  }
  return "";
}

function storageSet(key: string, value: string) {
  try {
    // @ts-expect-error uni global
    if (typeof uni !== "undefined" && uni.setStorageSync) {
      uni.setStorageSync(key, value);
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function readLibrary(coachId = "poppy"): CoachStrokeLibrary {
  const raw = storageGet(COACH_STROKE_LIBRARY_KEY);
  if (!raw) return emptyLibrary(coachId);
  try {
    const parsed = JSON.parse(raw) as CoachStrokeLibrary;
    return {
      ...emptyLibrary(coachId),
      ...parsed,
      coachName: COACH_DISPLAY_NAME_ZH,
      entries: parsed.entries || {},
    };
  } catch {
    return emptyLibrary(coachId);
  }
}

export function writeLibrary(lib: CoachStrokeLibrary): CoachStrokeLibrary {
  const next = { ...lib, coachName: COACH_DISPLAY_NAME_ZH, updatedAt: new Date().toISOString() };
  storageSet(COACH_STROKE_LIBRARY_KEY, JSON.stringify(next));
  return next;
}

export function upsertEntry(
  strokeId: CoachLibraryStrokeId,
  patch: Partial<Pick<CoachStrokeEntry, "prompt" | "videoUrl" | "title">>,
  coachId = "poppy",
): CoachStrokeLibrary {
  const lib = readLibrary(coachId);
  const prev = lib.entries[strokeId];
  lib.entries[strokeId] = {
    strokeId,
    prompt: patch.prompt ?? prev?.prompt ?? "",
    videoUrl: patch.videoUrl ?? prev?.videoUrl ?? "",
    title: patch.title ?? prev?.title ?? "",
    updatedAt: new Date().toISOString(),
  };
  return writeLibrary(lib);
}
