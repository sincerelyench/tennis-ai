/** Map /tai job status → UI progress (steps, %, ETA, preview). */

export type EtaStep = {
  step: number;
  name?: string;
  seconds?: number;
  label?: string;
};

export type TaiJobLike = {
  id?: string;
  status?: string;
  step?: number | string;
  step_name?: string;
  progress?: number | string;
  message?: string;
  source_name?: string;
  eta_hint?: string;
  eta_remaining_s?: number | string;
  eta_steps?: EtaStep[];
  preview_rev?: number | string;
  preview_url?: string;
};

export const PIPELINE_STEPS = [
  { step: 1, name: "读取视频", blurb: "打开你的录像", eta: "约 15 秒" },
  { step: 2, name: "识别动作", blurb: "看清挥拍动作", eta: "约 3–6 分钟" },
  { step: 3, name: "找出挥拍", blurb: "标出每一次击球", eta: "约 30 秒" },
  { step: 4, name: "整理数据", blurb: "整理评分依据", eta: "约 1 分钟" },
  { step: 5, name: "教练点评", blurb: "涨球教练生成练习建议", eta: "约 2 分钟，最慢" },
] as const;

/** Fallback % when job.progress is missing (same as prior clients). */
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
      blurb: base.blurb,
      eta: (hit && hit.label) || base.eta,
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

export function leaveHint(job?: TaiJobLike | null): string {
  const hint = (job?.eta_hint || "").trim();
  if (hint) return hint;
  return "关掉页面也不会中断，回来可继续查看进度。";
}
