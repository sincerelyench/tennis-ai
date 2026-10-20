const DEFAULT_COACH_ID = "poppy";
const DEFAULT_COACH_NAME_ZH = "掌球教练";
const DEFAULT_COACH_NAME_EN = "Zhangqiu Coach";
const COACH_PUBLISH_KEY = "tennis-coach-publish-v1";
const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";
const TRAIN_STUB_MS = 8000;

function normalizeDisplayName(name) {
  const raw = String(name || "").trim();
  if (!raw || /poppy|东东|dongdong/i.test(raw)) return DEFAULT_COACH_NAME_ZH;
  return raw.slice(0, 40);
}

function emptyProfile(coachId) {
  return {
    coachId: coachId || DEFAULT_COACH_ID,
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

function advanceTrainJob(profile, now) {
  now = now || Date.now();
  if (!profile.trainJob) return profile;
  if (profile.status !== "queued" && profile.status !== "training") return profile;
  const job = Object.assign({}, profile.trainJob);
  const readyAt = Date.parse(job.readyAt);
  const startedAt = Date.parse(job.startedAt);
  const elapsed = Math.max(0, now - startedAt);
  const total = Math.max(1, readyAt - startedAt);
  if (now >= readyAt) {
    job.status = "ready";
    job.progress = 100;
    return Object.assign({}, profile, {
      status: "ready",
      trainJob: job,
      updatedAt: new Date(now).toISOString(),
    });
  }
  if (elapsed < total * 0.25) {
    job.status = "queued";
    job.progress = Math.min(15, Math.round((elapsed / total) * 40));
    return Object.assign({}, profile, {
      status: "queued",
      trainJob: job,
      updatedAt: new Date(now).toISOString(),
    });
  }
  job.status = "training";
  job.progress = Math.min(95, Math.round((elapsed / total) * 100));
  return Object.assign({}, profile, {
    status: "training",
    trainJob: job,
    updatedAt: new Date(now).toISOString(),
  });
}

function readStore() {
  try {
    const raw = wx.getStorageSync(COACH_PUBLISH_KEY);
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  wx.setStorageSync(COACH_PUBLISH_KEY, store);
}

function readPublish(coachId) {
  const id = coachId || DEFAULT_COACH_ID;
  const store = readStore();
  const p = store[id] || emptyProfile(id);
  return advanceTrainJob(
    Object.assign(emptyProfile(id), p, {
      displayName: normalizeDisplayName(p.displayName),
    }),
  );
}

function writePublish(profile) {
  const next = advanceTrainJob(
    Object.assign({}, profile, {
      displayName: normalizeDisplayName(profile.displayName),
      updatedAt: new Date().toISOString(),
    }),
  );
  const store = readStore();
  store[next.coachId] = next;
  writeStore(store);
  return next;
}

function listPublished() {
  return Object.keys(readStore())
    .map((id) => readPublish(id))
    .filter((p) => p.status === "published");
}

function getSelectedCoachId() {
  try {
    return wx.getStorageSync(PLAYER_SELECTED_COACH_KEY) || DEFAULT_COACH_ID;
  } catch (e) {
    return DEFAULT_COACH_ID;
  }
}

function setSelectedCoachId(coachId) {
  const id = String(coachId || DEFAULT_COACH_ID);
  wx.setStorageSync(PLAYER_SELECTED_COACH_KEY, id);
  return id;
}

function submitForTraining(profile, count) {
  const now = Date.now();
  const started = new Date(now).toISOString();
  return writePublish(
    Object.assign({}, profile, {
      libraryStrokeCount: count,
      status: "queued",
      submittedAt: started,
      publishedAt: null,
      rejectedReason: null,
      trainJob: {
        id: "train_" + profile.coachId + "_" + now,
        status: "queued",
        startedAt: started,
        readyAt: new Date(now + TRAIN_STUB_MS).toISOString(),
        progress: 0,
        note: "stub",
      },
    }),
  );
}

function requestPublish(profile, displayName, styleTagline) {
  const ts = new Date().toISOString();
  return writePublish(
    Object.assign({}, profile, {
      displayName: normalizeDisplayName(displayName),
      styleTagline: String(styleTagline || "").slice(0, 200),
      status: "published",
      publishedAt: ts,
      rejectedReason: null,
    }),
  );
}

function withdraw(profile) {
  return writePublish(
    Object.assign({}, profile, {
      status: "draft",
      trainJob: null,
      publishedAt: null,
      rejectedReason: null,
    }),
  );
}

function statusLabel(status, locale) {
  const zh = {
    draft: "草稿",
    queued: "训练排队中",
    training: "训练中",
    ready: "可申请发布",
    pending_review: "待审核",
    published: "已发布",
    rejected: "已驳回",
  };
  const en = {
    draft: "Draft",
    queued: "Training queued",
    training: "Training",
    ready: "Ready to publish",
    pending_review: "Pending review",
    published: "Published",
    rejected: "Rejected",
  };
  return (locale === "en" ? en : zh)[status] || status;
}

module.exports = {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  DEFAULT_COACH_NAME_EN,
  COACH_PUBLISH_KEY,
  PLAYER_SELECTED_COACH_KEY,
  normalizeDisplayName,
  emptyProfile,
  readPublish,
  writePublish,
  listPublished,
  getSelectedCoachId,
  setSelectedCoachId,
  submitForTraining,
  requestPublish,
  withdraw,
  statusLabel,
};
