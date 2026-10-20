const COACH_DISPLAY_NAME_ZH = "涨球教练";
const COACH_DISPLAY_NAME_EN = "Zhangqiu Coach";
const COACH_STROKE_LIBRARY_KEY = "tennis-coach-stroke-library-v1";

const COACH_LIBRARY_STROKES = [
  "fh-topspin",
  "fh-slice",
  "fh-volley",
  "bh-topspin",
  "bh-slice",
  "bh-volley",
  "serve",
  "smash",
];

function emptyLibrary(coachId) {
  return {
    coachId: coachId || "poppy",
    coachName: COACH_DISPLAY_NAME_ZH,
    entries: {},
    updatedAt: new Date().toISOString(),
  };
}

function readLibrary(coachId) {
  try {
    const raw = wx.getStorageSync(COACH_STROKE_LIBRARY_KEY);
    if (!raw) return emptyLibrary(coachId);
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Object.assign(emptyLibrary(coachId), parsed, {
      coachName: COACH_DISPLAY_NAME_ZH,
      entries: parsed.entries || {},
    });
  } catch (e) {
    return emptyLibrary(coachId);
  }
}

function writeLibrary(lib) {
  const next = Object.assign({}, lib, {
    coachName: COACH_DISPLAY_NAME_ZH,
    updatedAt: new Date().toISOString(),
  });
  wx.setStorageSync(COACH_STROKE_LIBRARY_KEY, next);
  return next;
}

function upsertEntry(strokeId, patch, coachId) {
  const lib = readLibrary(coachId);
  const prev = lib.entries[strokeId] || {};
  lib.entries[strokeId] = {
    strokeId: strokeId,
    prompt: patch.prompt != null ? patch.prompt : prev.prompt || "",
    videoUrl: patch.videoUrl != null ? patch.videoUrl : prev.videoUrl || "",
    title: patch.title != null ? patch.title : prev.title || "",
    updatedAt: new Date().toISOString(),
  };
  return writeLibrary(lib);
}

module.exports = {
  COACH_DISPLAY_NAME_ZH,
  COACH_DISPLAY_NAME_EN,
  COACH_STROKE_LIBRARY_KEY,
  COACH_LIBRARY_STROKES,
  emptyLibrary,
  readLibrary,
  writeLibrary,
  upsertEntry,
};
