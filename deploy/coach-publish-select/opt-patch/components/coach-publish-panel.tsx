"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_EN,
  DEFAULT_COACH_NAME_ZH,
  canRequestPublish,
  canSubmitTrain,
  canWithdraw,
  emptyProfile,
  statusLabel,
  type CoachPublishProfile,
  writePublishClient,
} from "@/lib/coach-publish";

type Locale = "zh" | "en";

type Props = {
  locale?: Locale;
  coachId?: string;
  /** Strokes currently filled in the library UI (from parent). */
  libraryStrokeCount?: number;
  onProfileChange?: (p: CoachPublishProfile) => void;
};

function copy(locale: Locale) {
  if (locale === "zh") {
    return {
      title: "发布与训练",
      lead: "动作库材料会送后台按你的风格训练。训练完成后可申请发布；平台通过后，球员即可选择你的风格。",
      coach: DEFAULT_COACH_NAME_ZH,
      status: "当前状态",
      progress: "训练进度",
      name: "发布显示名",
      namePh: DEFAULT_COACH_NAME_ZH,
      style: "风格简介",
      stylePh: "例如：稳健底线、强调随挥放松…",
      submit: "提交训练",
      publishing: "申请发布",
      withdraw: "撤回",
      emptyLib: "请先在动作库保存至少一项技术，再提交训练。",
      stub: "训练为异步 stub（排队 / 训练中 / 就绪）。真实 GPU 训练可挂同一状态机。",
      loading: "加载发布状态…",
      error: "加载失败，请重试。",
      retry: "重试",
      flashTrain: "已提交训练",
      flashPub: "已申请发布",
      flashWith: "已撤回为草稿",
      busy: "处理中…",
    };
  }
  return {
    title: "Publish & training",
    lead: "Library materials go to the backend for your style. When training finishes, request publish; after platform accept, players can pick your style.",
    coach: DEFAULT_COACH_NAME_EN,
    status: "Status",
    progress: "Training progress",
    name: "Published display name",
    namePh: DEFAULT_COACH_NAME_EN,
    style: "Style blurb",
    stylePh: "e.g. Steady baseline, relaxed follow-through…",
    submit: "Submit for training",
    publishing: "Request publish",
    withdraw: "Withdraw",
    emptyLib: "Save at least one stroke in the library before training.",
    stub: "Training is an async stub (queued / training / ready). Real GPU train hooks the same state machine.",
    loading: "Loading publish status…",
    error: "Could not load. Try again.",
    retry: "Retry",
    flashTrain: "Training submitted",
    flashPub: "Publish requested",
    flashWith: "Withdrawn to draft",
    busy: "Working…",
  };
}

export function CoachPublishPanel({
  locale = "zh",
  coachId = DEFAULT_COACH_ID,
  libraryStrokeCount,
  onProfileChange,
}: Props) {
  const t = copy(locale);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [profile, setProfile] = useState<CoachPublishProfile>(() => emptyProfile(coachId));
  const [displayName, setDisplayName] = useState(DEFAULT_COACH_NAME_ZH);
  const [styleTagline, setStyleTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const apply = useCallback(
    (p: CoachPublishProfile) => {
      setProfile(p);
      setDisplayName(p.displayName || DEFAULT_COACH_NAME_ZH);
      setStyleTagline(p.styleTagline || "");
      writePublishClient(p);
      onProfileChange?.(p);
    },
    [onProfileChange],
  );

  const load = useCallback(async () => {
    setPhase("loading");
    setErrMsg("");
    try {
      const res = await fetch(
        `/tennis/api/coach/publish?coachId=${encodeURIComponent(coachId)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      apply(data.profile || emptyProfile(coachId));
      setPhase("ready");
    } catch (e) {
      try {
        const raw = window.localStorage.getItem("tennis-coach-publish-v1");
        if (raw) {
          const store = JSON.parse(raw) as Record<string, CoachPublishProfile>;
          apply(store[coachId] || emptyProfile(coachId));
          setPhase("ready");
          return;
        }
      } catch {
        /* ignore */
      }
      setErrMsg(String(e));
      setPhase("error");
    }
  }, [apply, coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while queued/training so stub advances.
  useEffect(() => {
    if (profile.status !== "queued" && profile.status !== "training") return;
    const id = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(id);
  }, [load, profile.status]);

  const strokeCount = libraryStrokeCount ?? profile.libraryStrokeCount;

  async function postTrain() {
    setBusy(true);
    setFlash("");
    setErrMsg("");
    try {
      const res = await fetch(`/tennis/api/coach/train?coachId=${encodeURIComponent(coachId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          libraryStrokeCount: strokeCount,
          displayName,
          styleTagline,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        apply(data.profile);
        setFlash(t.flashTrain);
      } else {
        // Local stub fallback
        const { submitForTraining } = await import("@/lib/coach-publish");
        const next = submitForTraining(
          { ...profile, displayName, styleTagline, libraryStrokeCount: strokeCount },
          strokeCount,
        );
        apply(next);
        setFlash(t.flashTrain);
      }
    } catch (e) {
      setErrMsg(String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(""), 2000);
    }
  }

  async function postPublish(action: "request" | "withdraw") {
    setBusy(true);
    setFlash("");
    setErrMsg("");
    try {
      const res = await fetch(`/tennis/api/coach/publish?coachId=${encodeURIComponent(coachId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          displayName,
          styleTagline,
          autoAccept: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        apply(data.profile);
        setFlash(action === "request" ? t.flashPub : t.flashWith);
      } else {
        const mod = await import("@/lib/coach-publish");
        const next =
          action === "request"
            ? mod.requestPublish({ ...profile, displayName, styleTagline }, {
                displayName,
                styleTagline,
                autoAccept: true,
              })
            : mod.withdraw(profile);
        apply(next);
        setFlash(action === "request" ? t.flashPub : t.flashWith);
      }
    } catch (e) {
      setErrMsg(String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(""), 2000);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-md space-y-2 px-4 py-3" data-coach-publish="loading">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto w-full max-w-md space-y-2 px-4 py-3" data-coach-publish="error">
        <p className="text-sm text-destructive">{t.error}</p>
        {errMsg ? <p className="text-xs text-muted-foreground">{errMsg}</p> : null}
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => void load()}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const showSubmit = canSubmitTrain({ ...profile, libraryStrokeCount: strokeCount });
  const showPublish = canRequestPublish(profile);
  const showWithdraw = canWithdraw(profile);

  return (
    <section
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
      data-coach-publish="true"
      data-status={profile.status}
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold text-primary">{t.coach}</p>
        <h2 className="text-lg font-bold text-foreground">{t.title}</h2>
        <p className="text-sm leading-5 text-muted-foreground">{t.lead}</p>
      </header>

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <p className="text-sm">
          <span className="font-semibold">{t.status}：</span>
          <span data-status-label="true">{statusLabel(profile.status, locale)}</span>
        </p>
        {profile.trainJob && (profile.status === "queued" || profile.status === "training") ? (
          <p className="text-sm" data-train-progress="true">
            <span className="font-semibold">{t.progress}：</span>
            {profile.trainJob.progress}%
          </p>
        ) : null}
        {strokeCount <= 0 ? (
          <p className="text-xs text-muted-foreground" data-empty-library="true">
            {t.emptyLib}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t.stub}</p>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t.name}</span>
          <input
            data-field="display-name"
            className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            placeholder={t.namePh}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t.style}</span>
          <input
            data-field="style-tagline"
            className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            placeholder={t.stylePh}
            value={styleTagline}
            onChange={(e) => setStyleTagline(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          {showSubmit ? (
            <button
              type="button"
              data-action="submit-train"
              disabled={busy || strokeCount <= 0}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => void postTrain()}
            >
              {busy ? t.busy : t.submit}
            </button>
          ) : null}
          {showPublish ? (
            <button
              type="button"
              data-action="request-publish"
              disabled={busy}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => void postPublish("request")}
            >
              {busy ? t.busy : t.publishing}
            </button>
          ) : null}
          {showWithdraw ? (
            <button
              type="button"
              data-action="withdraw"
              disabled={busy}
              className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-medium disabled:opacity-50"
              onClick={() => void postPublish("withdraw")}
            >
              {busy ? t.busy : t.withdraw}
            </button>
          ) : null}
          {flash ? (
            <span className="self-center text-xs font-semibold text-primary" data-flash="true">
              {flash}
            </span>
          ) : null}
        </div>
        {errMsg ? <p className="text-xs text-destructive">{errMsg}</p> : null}
      </div>
    </section>
  );
}

export default CoachPublishPanel;
