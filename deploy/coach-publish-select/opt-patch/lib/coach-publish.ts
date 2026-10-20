/**
 * Coach library publish + training status for 涨球.
 * Drop into /opt/tennis-ai/lib/.
 *
 * Flow: draft → queued/training → ready → published | rejected
 * CTAs: 提交训练 / 申请发布 / 撤回
 *
 * Default persona display name: 掌球教练 / Zhangqiu Coach (never Poppy / 东东).
 * Published coaches may override displayName with their own style name.
 */

export const DEFAULT_COACH_ID = "poppy";
export const DEFAULT_COACH_NAME_ZH = "掌球教练";
export const DEFAULT_COACH_NAME_EN = "Zhangqiu Coach";
export const COACH_PUBLISH_KEY = "tennis-coach-publish-v1";
export const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";

/** Stub: after this many ms in training, job becomes ready (hook real GPU later). */
export const TRAIN_STUB_MS = 8_000;

export type CoachPublishStatus =
  | "draft"
  | "queued"
  | "training"
  | "ready"
  | "pending_review"
  | "published"
  | "rejected";

export type TrainJob = {
  id: string;
  status: "queued" | "training" | "ready" | "failed";
  startedAt: string;
  /** Wall-clock when stub should flip to ready (client/server poll advances). */
  readyAt: string;
  progress: number;
  note: string;
};

export type CoachPublishProfile = {
  coachId: string;
  /** Shown to players. Default 掌球教练; coach may set a style name when publishing. */
  displayName: string;
  /** Short style / persona blurb (different coaches = different styles). */
  styleTagline: string;
  status: CoachPublishStatus;
  trainJob: TrainJob | null;
  submittedAt: string | null;
  publishedAt: string | null;
  rejectedReason: string | null;
  /** Count of strokes with prompt or video — used for empty-state gating. */
  libraryStrokeCount: number;
  updatedAt: string;
};

export function defaultDisplayName(locale: "zh" | "en" = "zh"): string {
  return locale === "en" ? DEFAULT_COACH_NAME_EN : DEFAULT_COACH_NAME_ZH;
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

export function normalizeDisplayName(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return DEFAULT_COACH_NAME_ZH;
  // Guard against legacy Poppy / 东东 leaking into published UI.
  const banned = /poppy|东东|dongdong/i;
  if (banned.test(raw)) return DEFAULT_COACH_NAME_ZH;
  return raw.slice(0, 40);
}

/** Advance stub train job based on wall clock. Safe to call on every GET. */
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
    return {
      ...profile,
      status: "ready",
      trainJob: job,
      updatedAt: new Date(now).toISOString(),
    };
  }

  // First third of window stays queued; rest is training.
  if (elapsed < total * 0.25) {
    job.status = "queued";
    job.progress = Math.min(15, Math.round((elapsed / total) * 40));
    return {
      ...profile,
      status: "queued",
      trainJob: job,
      updatedAt: new Date(now).toISOString(),
    };
  }

  job.status = "training";
  job.progress = Math.min(95, Math.round((elapsed / total) * 100));
  return {
    ...profile,
    status: "training",
    trainJob: job,
    updatedAt: new Date(now).toISOString(),
  };
}

export function canSubmitTrain(profile: CoachPublishProfile): boolean {
  return (
    profile.libraryStrokeCount > 0 &&
    (profile.status === "draft" || profile.status === "rejected")
  );
}

export function canRequestPublish(profile: CoachPublishProfile): boolean {
  return profile.status === "ready";
}

export function canWithdraw(profile: CoachPublishProfile): boolean {
  return (
    profile.status === "queued" ||
    profile.status === "training" ||
    profile.status === "ready" ||
    profile.status === "pending_review" ||
    profile.status === "published"
  );
}

export function submitForTraining(
  profile: CoachPublishProfile,
  libraryStrokeCount: number,
  now = Date.now(),
): CoachPublishProfile {
  const started = new Date(now).toISOString();
  const readyAt = new Date(now + TRAIN_STUB_MS).toISOString();
  return {
    ...profile,
    libraryStrokeCount,
    displayName: normalizeDisplayName(profile.displayName),
    status: "queued",
    submittedAt: started,
    publishedAt: null,
    rejectedReason: null,
    trainJob: {
      id: `train_${profile.coachId}_${now}`,
      status: "queued",
      startedAt: started,
      readyAt,
      progress: 0,
      note: "Queued for style training (stub — real GPU train hooks here later).",
    },
    updatedAt: started,
  };
}

export function requestPublish(
  profile: CoachPublishProfile,
  opts?: { displayName?: string; styleTagline?: string; autoAccept?: boolean },
  now = Date.now(),
): CoachPublishProfile {
  const displayName = normalizeDisplayName(opts?.displayName ?? profile.displayName);
  const styleTagline = String(opts?.styleTagline ?? profile.styleTagline ?? "").slice(0, 200);
  const autoAccept = opts?.autoAccept !== false; // stub platform accepts by default
  const ts = new Date(now).toISOString();
  if (autoAccept) {
    return {
      ...profile,
      displayName,
      styleTagline,
      status: "published",
      publishedAt: ts,
      rejectedReason: null,
      updatedAt: ts,
    };
  }
  return {
    ...profile,
    displayName,
    styleTagline,
    status: "pending_review",
    rejectedReason: null,
    updatedAt: ts,
  };
}

export function acceptPublish(profile: CoachPublishProfile, now = Date.now()): CoachPublishProfile {
  const ts = new Date(now).toISOString();
  return {
    ...profile,
    displayName: normalizeDisplayName(profile.displayName),
    status: "published",
    publishedAt: ts,
    rejectedReason: null,
    updatedAt: ts,
  };
}

export function rejectPublish(
  profile: CoachPublishProfile,
  reason: string,
  now = Date.now(),
): CoachPublishProfile {
  return {
    ...profile,
    status: "rejected",
    rejectedReason: String(reason || "Platform rejected").slice(0, 500),
    publishedAt: null,
    updatedAt: new Date(now).toISOString(),
  };
}

export function withdraw(profile: CoachPublishProfile, now = Date.now()): CoachPublishProfile {
  return {
    ...profile,
    status: "draft",
    trainJob: null,
    publishedAt: null,
    rejectedReason: null,
    updatedAt: new Date(now).toISOString(),
  };
}

export function readPublishClient(coachId = DEFAULT_COACH_ID): CoachPublishProfile {
  if (typeof window === "undefined") return emptyProfile(coachId);
  try {
    const raw = window.localStorage.getItem(COACH_PUBLISH_KEY);
    if (!raw) return emptyProfile(coachId);
    const store = JSON.parse(raw) as Record<string, CoachPublishProfile>;
    const profile = store[coachId] || emptyProfile(coachId);
    return advanceTrainJob({
      ...emptyProfile(coachId),
      ...profile,
      coachId,
      displayName: normalizeDisplayName(profile.displayName),
    });
  } catch {
    return emptyProfile(coachId);
  }
}

export function writePublishClient(profile: CoachPublishProfile): CoachPublishProfile {
  const next = advanceTrainJob({
    ...profile,
    displayName: normalizeDisplayName(profile.displayName),
    updatedAt: new Date().toISOString(),
  });
  if (typeof window !== "undefined") {
    let store: Record<string, CoachPublishProfile> = {};
    try {
      const raw = window.localStorage.getItem(COACH_PUBLISH_KEY);
      if (raw) store = JSON.parse(raw);
    } catch {
      store = {};
    }
    store[next.coachId] = next;
    window.localStorage.setItem(COACH_PUBLISH_KEY, JSON.stringify(store));
  }
  return next;
}

export function listPublishedClient(): CoachPublishProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COACH_PUBLISH_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as Record<string, CoachPublishProfile>;
    return Object.values(store)
      .map((p) => advanceTrainJob({ ...emptyProfile(p.coachId), ...p, displayName: normalizeDisplayName(p.displayName) }))
      .filter((p) => p.status === "published");
  } catch {
    return [];
  }
}

export function readSelectedCoachClient(): string {
  if (typeof window === "undefined") return DEFAULT_COACH_ID;
  try {
    return window.localStorage.getItem(PLAYER_SELECTED_COACH_KEY) || DEFAULT_COACH_ID;
  } catch {
    return DEFAULT_COACH_ID;
  }
}

export function writeSelectedCoachClient(coachId: string): string {
  const id = String(coachId || DEFAULT_COACH_ID).trim() || DEFAULT_COACH_ID;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PLAYER_SELECTED_COACH_KEY, id);
  }
  return id;
}

export function statusLabel(status: CoachPublishStatus, locale: "zh" | "en"): string {
  const zh: Record<CoachPublishStatus, string> = {
    draft: "草稿",
    queued: "训练排队中",
    training: "训练中",
    ready: "可申请发布",
    pending_review: "待平台审核",
    published: "已发布",
    rejected: "已驳回",
  };
  const en: Record<CoachPublishStatus, string> = {
    draft: "Draft",
    queued: "Training queued",
    training: "Training",
    ready: "Ready to publish",
    pending_review: "Pending review",
    published: "Published",
    rejected: "Rejected",
  };
  return (locale === "en" ? en : zh)[status];
}
