"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COACH_DISPLAY_NAME_EN,
  COACH_DISPLAY_NAME_ZH,
  COACH_LIBRARY_STROKES,
  type CoachLibraryStrokeId,
  type CoachStrokeEntry,
  type CoachStrokeLibrary,
  emptyLibrary,
  upsertEntryClient,
  writeLibraryClient,
} from "@/lib/coach-stroke-library";

type Locale = "zh" | "en";

type Props = {
  locale?: Locale;
  coachId?: string;
  /** When true, also mirror text/videoUrl into localStorage for offline/H5. */
  mirrorLocal?: boolean;
};

const STROKE_LABEL: Record<Locale, Record<CoachLibraryStrokeId, string>> = {
  zh: {
    "fh-topspin": "正手上旋",
    "fh-slice": "正手切削",
    "fh-volley": "正手截击",
    "bh-topspin": "反手上旋",
    "bh-slice": "反手切削",
    "bh-volley": "反手截击",
    serve: "发球",
    smash: "高压球",
  },
  en: {
    "fh-topspin": "Forehand topspin",
    "fh-slice": "Forehand slice",
    "fh-volley": "Forehand volley",
    "bh-topspin": "Backhand topspin",
    "bh-slice": "Backhand slice",
    "bh-volley": "Backhand volley",
    serve: "Serve",
    smash: "Overhead smash",
  },
};

function copy(locale: Locale) {
  if (locale === "zh") {
    return {
      title: "动作库 / 我的示范",
      lead: `${COACH_DISPLAY_NAME_ZH}可为本账号跟踪的每一项技术上传讲解文字与正确动作示范视频。学员与分析会优先使用这里的材料。`,
      coach: COACH_DISPLAY_NAME_ZH,
      prompt: "讲解 / 分析提示",
      promptPh: "写出你教这项技术时的要点，可作分析 prompt 材料…",
      titleLabel: "示范标题",
      titlePh: "例如：涨球教练 · 正手上旋",
      video: "示范视频",
      upload: "上传视频",
      url: "或粘贴可播放链接",
      urlPh: "https://…",
      save: "保存此项",
      saving: "保存中…",
      saved: "已保存",
      clearVideo: "清除视频",
      empty: "尚未填写。保存后学员端可见。",
      loading: "加载动作库…",
      error: "加载失败，请重试。",
      retry: "重试",
      statusFilled: "已有内容",
      statusEmpty: "空",
      pickStroke: "选择技术",
      fileHint: "支持 mp4 / webm / mov，最大约 80MB。",
    };
  }
  return {
    title: "Stroke library / My demos",
    lead: `${COACH_DISPLAY_NAME_EN} can upload teaching copy and a correct-motion demo for every stroke the app tracks. Players and analysis prefer this library when set.`,
    coach: COACH_DISPLAY_NAME_EN,
    prompt: "Teaching text / analysis prompt",
    promptPh: "How you teach this stroke — used as analysis prompt material…",
    titleLabel: "Demo title",
    titlePh: "e.g. Zhangqiu Coach · Forehand topspin",
    video: "Demo video",
    upload: "Upload video",
    url: "Or paste a playable URL",
    urlPh: "https://…",
    save: "Save stroke",
    saving: "Saving…",
    saved: "Saved",
    clearVideo: "Clear video",
    empty: "Nothing saved yet. Players see it after you save.",
    loading: "Loading stroke library…",
    error: "Could not load. Try again.",
    retry: "Retry",
    statusFilled: "Has content",
    statusEmpty: "Empty",
    pickStroke: "Pick a stroke",
    fileHint: "mp4 / webm / mov, up to ~80MB.",
  };
}

export function CoachStrokeLibraryView({
  locale = "zh",
  coachId = "poppy",
  mirrorLocal = true,
}: Props) {
  const t = copy(locale);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [lib, setLib] = useState<CoachStrokeLibrary>(() => emptyLibrary(coachId));
  const [strokeId, setStrokeId] = useState<CoachLibraryStrokeId>("fh-topspin");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const labels = STROKE_LABEL[locale];

  const applyEntry = useCallback((entry: CoachStrokeEntry | null | undefined) => {
    setPrompt(entry?.prompt || "");
    setTitle(entry?.title || "");
    setVideoUrl(entry?.videoUrl || "");
  }, []);

  const load = useCallback(async () => {
    setPhase("loading");
    setErrMsg("");
    try {
      const res = await fetch(`/tennis/api/coach/library?coachId=${encodeURIComponent(coachId)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const next: CoachStrokeLibrary = data.library || emptyLibrary(coachId);
      setLib(next);
      if (mirrorLocal) writeLibraryClient(next);
      applyEntry(next.entries[strokeId]);
      setPhase("ready");
    } catch (e) {
      // Fall back to localStorage so coaches can still curate offline / before API is deployed.
      try {
        const raw = window.localStorage.getItem("tennis-coach-stroke-library-v1");
        if (raw) {
          const parsed = JSON.parse(raw) as CoachStrokeLibrary;
          setLib(parsed);
          applyEntry(parsed.entries?.[strokeId]);
          setPhase("ready");
          return;
        }
      } catch {
        /* ignore */
      }
      setErrMsg(String(e));
      setPhase("error");
    }
  }, [applyEntry, coachId, mirrorLocal, strokeId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  useEffect(() => {
    applyEntry(lib.entries[strokeId]);
  }, [applyEntry, lib.entries, strokeId]);

  const filled = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const id of COACH_LIBRARY_STROKES) {
      const e = lib.entries[id];
      map[id] = Boolean(e && (e.prompt?.trim() || e.videoUrl?.trim()));
    }
    return map;
  }, [lib.entries]);

  async function onSave() {
    setBusy(true);
    setFlash("");
    setErrMsg("");
    try {
      const res = await fetch(`/tennis/api/coach/library?coachId=${encodeURIComponent(coachId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strokeId, prompt, title, videoUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        const next = data.library as CoachStrokeLibrary;
        setLib(next);
        if (mirrorLocal) writeLibraryClient(next);
        setFlash(t.saved);
      } else {
        // API not deployed yet — persist locally.
        const next = upsertEntryClient(strokeId, { prompt, title, videoUrl }, coachId);
        setLib(next);
        setFlash(t.saved);
      }
    } catch {
      const next = upsertEntryClient(strokeId, { prompt, title, videoUrl }, coachId);
      setLib(next);
      setFlash(t.saved);
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(""), 2000);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErrMsg("");
    try {
      const body = new FormData();
      body.append("strokeId", strokeId);
      body.append("coachId", coachId);
      body.append("title", title);
      body.append("prompt", prompt);
      body.append("video", file);
      const res = await fetch("/tennis/api/coach/library/upload", {
        method: "POST",
        credentials: "include",
        body,
      });
      if (res.ok) {
        const data = await res.json();
        const next = data.library as CoachStrokeLibrary;
        setLib(next);
        applyEntry(data.entry);
        if (mirrorLocal) writeLibraryClient(next);
        setFlash(t.saved);
        return;
      }
      // Local blob fallback when upload API is not on the server yet.
      const blobUrl = URL.createObjectURL(file);
      setVideoUrl(blobUrl);
      const next = upsertEntryClient(
        strokeId,
        { prompt, title: title || file.name, videoUrl: blobUrl },
        coachId,
      );
      setLib(next);
      setFlash(t.saved);
    } catch (e) {
      setErrMsg(String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(""), 2000);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 px-4 py-4" data-coach-library="loading">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 px-4 py-4" data-coach-library="error">
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

  return (
    <div
      className="mx-auto w-full max-w-md space-y-4 px-4 py-4"
      data-coach-library="true"
      data-page="coach-library"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold text-primary">{t.coach}</p>
        <h1 className="text-xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm leading-5 text-muted-foreground">{t.lead}</p>
      </header>

      <section className="space-y-2" aria-label={t.pickStroke}>
        <p className="text-xs font-semibold text-muted-foreground">{t.pickStroke}</p>
        <div className="flex flex-wrap gap-2">
          {COACH_LIBRARY_STROKES.map((id) => (
            <button
              key={id}
              type="button"
              data-stroke={id}
              data-filled={filled[id] ? "1" : "0"}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (strokeId === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground")
              }
              onClick={() => setStrokeId(id)}
            >
              {labels[id]}
              {filled[id] ? " · ✓" : ""}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="coach-lib-prompt">
            {t.prompt}
          </label>
          <textarea
            id="coach-lib-prompt"
            data-field="prompt"
            className="min-h-28 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
            placeholder={t.promptPh}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="coach-lib-title">
            {t.titleLabel}
          </label>
          <input
            id="coach-lib-title"
            data-field="title"
            className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            placeholder={t.titlePh}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t.video}</p>
          {videoUrl ? (
            <video
              key={videoUrl}
              data-demo-video="true"
              className="w-full rounded-lg bg-black"
              src={videoUrl}
              controls
              playsInline
            />
          ) : (
            <p className="text-xs text-muted-foreground" data-empty-video="true">
              {t.empty}
            </p>
          )}
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
            {t.upload}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              data-field="video-file"
              disabled={busy}
              onChange={(e) => void onUpload(e.target.files?.[0] || null)}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t.fileHint}</p>
          <label className="block space-y-1 text-sm" htmlFor="coach-lib-url">
            <span className="font-medium">{t.url}</span>
            <input
              id="coach-lib-url"
              data-field="video-url"
              className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              placeholder={t.urlPh}
              value={videoUrl.startsWith("blob:") ? "" : videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </label>
          {videoUrl ? (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground underline"
              onClick={() => setVideoUrl("")}
            >
              {t.clearVideo}
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-action="save-stroke"
            disabled={busy}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={() => void onSave()}
          >
            {busy ? t.saving : t.save}
          </button>
          {flash ? (
            <span className="text-xs font-semibold text-primary" data-flash="saved">
              {flash}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default CoachStrokeLibraryView;
