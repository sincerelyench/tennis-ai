import { translate, type Locale } from "@/lib/i18n/translate";

export type EtaStep = {
  step: number;
  name?: string;
  seconds?: number;
  label?: string;
};

export type JobProgressFields = {
  id?: string;
  status?: string;
  step?: number | string;
  step_name?: string;
  progress?: number | string;
  eta_hint?: string;
  eta_remaining_s?: number | string;
  eta_steps?: EtaStep[];
  message?: string;
  source_name?: string;
  preview_rev?: number | string;
  preview_url?: string;
  analyze_mode?: string;
  cached?: boolean;
};

/** Alias used by AnalyzeProgress roadmap UI. */
export type TaiJobLike = JobProgressFields;

export type DisplayProgress = {
  percent: number;
  eta: string;
  approximate: boolean;
  stepName: string;
  message: string;
  done: boolean;
};

/** When the API omits progress, use the 1–5 pipeline step. */
const STEP_PERCENT: Record<number, number> = {
  0: 3,
  1: 8,
  2: 40,
  3: 78,
  4: 86,
  5: 92,
};

const TYPICAL_SECONDS = 90; // full-path fallback; fast/cached use server eta_hint

const STEP_KEYS: Record<string, string> = {
  提交: "progress.submit",
  上传: "progress.upload",
  抽帧: "progress.frames",
  读取视频: "progress.frames",
  检测挥拍: "progress.swings",
  找出挥拍: "progress.swings",
  检测: "progress.detecting",
  姿态: "progress.pose",
  识别动作: "progress.pose",
  分析: "progress.analyzing",
  教练点评: "progress.analyzing",
  生成报告: "progress.building",
  整理数据: "progress.building",
  写报告: "progress.writing",
  已完成: "progress.done",
};

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function formatRemain(seconds: number, locale: Locale) {
  if (seconds < 60) {
    const n = Math.max(1, Math.round(seconds));
    return n === 1 ? translate(locale, "progress.etaSec") : translate(locale, "progress.etaSecs", { n });
  }
  const n = Math.max(1, Math.round(seconds / 60));
  return n === 1 ? translate(locale, "progress.etaMin") : translate(locale, "progress.etaMins", { n });
}

function foldText(value: string) {
  return value.replace(/[。.…！!？?\s]/g, "").toLowerCase();
}

function sameText(a: string, b: string) {
  return Boolean(a && b && foldText(a) === foldText(b));
}

function stripLeading(text: string, prefix: string) {
  if (!prefix || !text.startsWith(prefix)) return text;
  return text.slice(prefix.length).replace(/^[，,、：:\s]+/, "");
}

function remainOnly(hint: string, stepName: string, message: string) {
  let text = hint.trim();
  if (!text || text === "已完成" || /^done$/i.test(text)) return "";
  if (sameText(text, stepName) || sameText(text, message)) return "";
  text = stripLeading(text, stepName);
  text = stripLeading(text, message);
  text = text.replace(/^约\s*/, "");
  text = text.replace(/^about\s+/i, "");
  if (!text || sameText(text, stepName) || sameText(text, message)) return "";
  if (!/还要|分钟|秒钟|\d+\s*秒|minute|second|\d+\s*s\b/i.test(text)) return "";
  return text;
}

function localizeStepName(name: string, locale: Locale) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (STEP_KEYS[trimmed]) return translate(locale, STEP_KEYS[trimmed]);
  for (const [zh, key] of Object.entries(STEP_KEYS)) {
    if (trimmed.includes(zh)) return translate(locale, key);
  }
  if (/[\u4e00-\u9fff]/.test(trimmed)) return "";
  return trimmed;
}

function localizeRemain(text: string, locale: Locale) {
  if (!text) return "";
  if (text === "已完成" || /^done$/i.test(text)) return "";
  const min = text.match(/(\d+)\s*(分钟|minutes?)/i);
  if (min) {
    const n = Number(min[1]);
    return n === 1 ? translate(locale, "progress.etaMin") : translate(locale, "progress.etaMins", { n });
  }
  const sec = text.match(/(\d+)\s*(秒钟?|seconds?)/i);
  if (sec) {
    const n = Number(sec[1]);
    return n === 1 ? translate(locale, "progress.etaSec") : translate(locale, "progress.etaSecs", { n });
  }
  if (/还要几秒|大约还要几秒|few seconds/i.test(text)) return translate(locale, "progress.etaFew");
  if (/即将打开报告|opening your report/i.test(text)) return translate(locale, "progress.opening");
  if (/[\u4e00-\u9fff]/.test(text)) return "";
  return text;
}

function localizeMessage(text: string, locale: Locale) {
  if (!text) return "";
  if (/分析完成|analysis complete/i.test(text)) return translate(locale, "progress.done");
  if (/[\u4e00-\u9fff]/.test(text)) return locale === "zh" ? text : "";
  return locale === "en" ? text : "";
}

export function displayProgress(
  job: JobProgressFields | null,
  phase: "submitting" | "running" | "done" | "error",
  locale: Locale = "en",
): DisplayProgress {
  const submitting = phase === "submitting" && !job;
  const done = phase === "done" || job?.status === "done";
  const fromJob = asNumber(job?.progress);
  const fromStep = asNumber(job?.step);
  let percent = submitting
    ? 2
    : fromJob != null
      ? Math.round(Math.max(0, Math.min(100, fromJob)))
      : fromStep != null && STEP_PERCENT[fromStep] != null
        ? STEP_PERCENT[fromStep]
        : 8;

  if (done) percent = 100;
  else percent = Math.min(99, percent);

  const stepName = submitting ? translate(locale, "progress.submit") : localizeStepName((job?.step_name || "").trim(), locale);
  const message = submitting ? "" : localizeMessage((job?.message || "").trim(), locale);
  let eta = localizeRemain(remainOnly(job?.eta_hint || "", job?.step_name || "", job?.message || ""), locale);
  let approximate = false;

  if (done) {
    eta = translate(locale, "progress.opening");
  } else if (!eta) {
    if (submitting) {
      eta = translate(locale, "progress.etaFew");
    } else {
      const remain = asNumber(job?.eta_remaining_s);
      if (remain != null && remain > 0) {
        eta = formatRemain(remain, locale);
      } else if (String(job?.analyze_mode || "") === "fast" || job?.cached) {
        eta = formatRemain(1, locale);
        approximate = true;
      } else {
        eta = formatRemain(TYPICAL_SECONDS * (1 - percent / 100), locale);
        approximate = true;
      }
    }
  }

  return {
    percent,
    eta,
    approximate,
    stepName: submitting ? translate(locale, "progress.submit") : stepName,
    message,
    done,
  };
}


/** Five-step roadmap for 涨球 waiting UI (titles only; no blurb/ETA on cards). */
export const PIPELINE_STEPS = [
  { step: 1, name: "读取视频" },
  { step: 2, name: "识别动作" },
  { step: 3, name: "找出挥拍" },
  { step: 4, name: "整理数据" },
  { step: 5, name: "教练点评" },
] as const;

/** Client poll interval while waiting on /tai job status (ms). */
export const ANALYZE_POLL_MS = 250;

export const STEP_PCT: Record<number, number> = {
  0: 3,
  1: 8,
  2: 40,
  3: 78,
  4: 86,
  5: 92,
};

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function jobStep(job?: TaiJobLike | null): number {
  const s = num(job?.step);
  if (s == null) return 0;
  return Math.max(0, Math.min(5, Math.round(s)));
}

export function jobPercent(job?: TaiJobLike | null, submitting = false): number {
  if (submitting) return Math.min(99, num(job?.progress) ?? 2);
  const done = String(job?.status || "") === "done";
  if (done) return 100;
  const raw = num(job?.progress);
  if (raw != null) return Math.max(0, Math.min(99, Math.round(raw)));
  const step = jobStep(job);
  return STEP_PCT[step] ?? 8;
}

export function mergedSteps(job?: TaiJobLike | null) {
  const api = Array.isArray(job?.eta_steps) ? job!.eta_steps! : [];
  return PIPELINE_STEPS.map((base) => {
    const hit = api.find((s) => Number(s.step) === base.step);
    return {
      step: base.step,
      name: (hit && hit.name) || base.name,
    };
  });
}

export function previewUrlFor(
  job: TaiJobLike | null | undefined,
  opts?: { taiBase?: string; localObjectUrl?: string | null },
): string | null {
  if (opts?.localObjectUrl) return opts.localObjectUrl;
  if (job?.preview_url) return String(job.preview_url);
  const id = job?.id;
  const rev = job?.preview_rev;
  if (!id || rev == null || rev === "") return null;
  const base = (opts?.taiBase || "/tai").replace(/\/$/, "");
  return `${base}/api/jobs/${encodeURIComponent(String(id))}/preview?r=${encodeURIComponent(String(rev))}`;
}

export function leaveHint(job?: TaiJobLike | null, submitting = false): string {
  if (submitting) {
    return "上传完成前请留在本页。离开或切换底部导航会中断提交。";
  }
  const hint = (job?.eta_hint || "").trim();
  if (hint) return hint;
  if (job?.cached) return "缓存命中，结果已就绪。";
  if (String(job?.analyze_mode || "") === "fast") {
    return "快速分析短片段，目标约 1 秒内出结果。";
  }
  return "关掉页面也不会中断，回来可继续查看进度。";
}

