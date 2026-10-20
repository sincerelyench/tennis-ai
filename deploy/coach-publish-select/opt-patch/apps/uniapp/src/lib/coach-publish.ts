/** Uni-app mirror of coach publish helpers (localStorage + API). Default name: 掌球教练. */

export const DEFAULT_COACH_ID = "poppy";
export const DEFAULT_COACH_NAME_ZH = "掌球教练";
export const DEFAULT_COACH_NAME_EN = "Zhangqiu Coach";
export const COACH_PUBLISH_KEY = "tennis-coach-publish-v1";
export const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";
export const TRAIN_STUB_MS = 8000;

export type CoachPublishStatus =
  | "draft"
  | "queued"
  | "training"
  | "ready"
  | "pending_review"
  | "published"
  | "rejected";

export type CoachPublishProfile = {
  coachId: string;
  displayName: string;
  styleTagline: string;
  status: CoachPublishStatus;
  trainJob: null | {
    id: string;
    status: string;
    startedAt: string;
    readyAt: string;
    progress: number;
    note: string;
  };
  submittedAt: string | null;
  publishedAt: string | null;
  rejectedReason: string | null;
  libraryStrokeCount: number;
  updatedAt: string;
};

export function normalizeDisplayName(name?: string): string {
  const raw = String(name || "").trim();
  if (!raw || /poppy|东东|dongdong/i.test(raw)) return DEFAULT_COACH_NAME_ZH;
  return raw.slice(0, 40);
}

export function emptyProfile(coachId = DEFAULT_COACH_ID): CoachPublishProfile {
  return {
    coachId,
    displayName: DEFAULT_COACH_NAME_ZH,
    styleTagline: "",
    status: "draft",
    trainJob: null,
    submittedAt: null,
    publishedAt: null,
    rejectedReason: null,
    libraryStrokeCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function advanceTrainJob(profile: CoachPublishProfile, now = Date.now()): CoachPublishProfile {
  if (!profile.trainJob) return profile;
  if (profile.status !== "queued" && profile.status !== "training") return profile;
  const job = { ...profile.trainJob };
  const readyAt = Date.parse(job.readyAt);
  const startedAt = Date.parse(job.startedAt);
  const elapsed = Math.max(0, now - startedAt);
  const total = Math.max(1, readyAt - startedAt);
  if (now >= readyAt) {
    job.status = "ready";
    job.progress = 100;
    return { ...profile, status: "ready", trainJob: job, updatedAt: new Date(now).toISOString() };
  }
  if (elapsed < total * 0.25) {
    job.status = "queued";
    job.progress = Math.min(15, Math.round((elapsed / total) * 40));
    return { ...profile, status: "queued", trainJob: job, updatedAt: new Date(now).toISOString() };
  }
  job.status = "training";
  job.progress = Math.min(95, Math.round((elapsed / total) * 100));
  return { ...profile, status: "training", trainJob: job, updatedAt: new Date(now).toISOString() };
}

function readStore(): Record<string, CoachPublishProfile> {
  try {
    const raw = uni.getStorageSync(COACH_PUBLISH_KEY);
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CoachPublishProfile>) {
  uni.setStorageSync(COACH_PUBLISH_KEY, store);
}

export function readPublish(coachId = DEFAULT_COACH_ID): CoachPublishProfile {
  const store = readStore();
  const p = store[coachId] || emptyProfile(coachId);
  return advanceTrainJob({
    ...emptyProfile(coachId),
    ...p,
    displayName: normalizeDisplayName(p.displayName),
  });
}

export function writePublish(profile: CoachPublishProfile): CoachPublishProfile {
  const next = advanceTrainJob({
    ...profile,
    displayName: normalizeDisplayName(profile.displayName),
    updatedAt: new Date().toISOString(),
  });
  const store = readStore();
  store[next.coachId] = next;
  writeStore(store);
  return next;
}

export function listPublished(): CoachPublishProfile[] {
  return Object.values(readStore())
    .map((p) => advanceTrainJob({ ...emptyProfile(p.coachId), ...p, displayName: normalizeDisplayName(p.displayName) }))
    .filter((p) => p.status === "published");
}

export function getSelectedCoachId(): string {
  try {
    return uni.getStorageSync(PLAYER_SELECTED_COACH_KEY) || DEFAULT_COACH_ID;
  } catch {
    return DEFAULT_COACH_ID;
  }
}

export function setSelectedCoachId(coachId: string): string {
  const id = String(coachId || DEFAULT_COACH_ID);
  uni.setStorageSync(PLAYER_SELECTED_COACH_KEY, id);
  return id;
}

export function submitForTraining(profile: CoachPublishProfile, count: number, now = Date.now()) {
  const started = new Date(now).toISOString();
  return writePublish({
    ...profile,
    libraryStrokeCount: count,
    status: "queued",
    submittedAt: started,
    publishedAt: null,
    rejectedReason: null,
    trainJob: {
      id: `train_${profile.coachId}_${now}`,
      status: "queued",
      startedAt: started,
      readyAt: new Date(now + TRAIN_STUB_MS).toISOString(),
      progress: 0,
      note: "stub",
    },
  });
}

export function requestPublish(profile: CoachPublishProfile, displayName: string, styleTagline: string) {
  const ts = new Date().toISOString();
  return writePublish({
    ...profile,
    displayName: normalizeDisplayName(displayName),
    styleTagline: String(styleTagline || "").slice(0, 200),
    status: "published",
    publishedAt: ts,
    rejectedReason: null,
  });
}

export function withdraw(profile: CoachPublishProfile) {
  return writePublish({
    ...profile,
    status: "draft",
    trainJob: null,
    publishedAt: null,
    rejectedReason: null,
  });
}
