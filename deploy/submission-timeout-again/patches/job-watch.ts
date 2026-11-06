import {
  analysisTitle,
  findLevel,
  findStroke,
  preferredTitle,
  reportSummary,
} from "@/lib/analysis";
import { clearActiveJob, readActiveJob, writeActiveJob, type ActiveJob } from "@/lib/active-job";
import type { JobProgressFields } from "@/lib/job-progress";
import { appClipUrl, mediaFromAlgo } from "@/lib/report-media";
import { addStoredReport, findReport } from "@/lib/report-store";
import { reportFindings } from "@/lib/reports";
import { readCoachId } from "@/lib/coach-roster";
import { ANALYZE_POLL_MS, ANALYZE_POLL_TRIES, taiFetch } from "@/lib/tai";
import { stampWhen } from "@/lib/analysis";
import { parseAxisScores } from "@/lib/report-scores";
import { translate, type Locale } from "@/lib/i18n/translate";

export type JobWatchPhase = "idle" | "submitting" | "running" | "done" | "error";

export type JobWatchState = {
  job: ActiveJob | null;
  phase: JobWatchPhase;
  reportId: string;
};

type AlgoJob = JobProgressFields & {
  status?: string;
  message?: string;
};

type AlgoReport = {
  title?: string;
  overall?: { score?: number; grade?: string; grade_label?: string; n_swings?: number; scores?: Record<string, number> };
  caveats?: string[];
  summary?: string;
  improvements?: string[];
  coach?: { summary?: string; improvements?: string[] };
  overlay_video?: string;
  cover_image?: string;
  preview?: string;
  stroke_mode?: string;
  stroke_label?: string;
  detect_rate?: number | string;
  generated_at?: string;
  created_at?: string;
};

const idle: JobWatchState = { job: null, phase: "idle", reportId: "" };
let state: JobWatchState = idle;
let generation = 0;
let watchingId = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: JobWatchState) {
  state = next;
  emit();
}

export function getJobWatch(): JobWatchState {
  return state;
}

export function subscribeJobWatch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function leaveCopy(phase: JobWatchPhase | "submitting" | "running" | "done" | "error", _locale: Locale = "en") {
  // Always Chinese: leaving during submit aborts the POST (nginx 499).
  if (phase === "submitting") return translate("zh", "job.leaveSubmit");
  if (phase === "running") return translate("zh", "job.leaveRunning");
  return "";
}

export function isPendingJobId(jobId?: string) {
  return Boolean(jobId && jobId.startsWith("pending-"));
}

export function markSubmitting(next: Omit<ActiveJob, "phase"> & { phase?: "submitting" }) {
  const stamped: ActiveJob = {
    ...next,
    jobId: next.jobId || `pending-${Date.now()}`,
    phase: "submitting",
    coachId: next.coachId || readCoachId(),
  };
  writeActiveJob(stamped);
  setState({ job: stamped, phase: "submitting", reportId: "" });
  return stamped;
}

export function ensureJobWatch() {
  if (typeof window === "undefined") return;
  const saved = readActiveJob();
  if (!saved?.jobId) {
    if (state.phase === "running" || state.phase === "submitting") setState(idle);
    return;
  }
  if (saved.phase === "error") {
    setState({ job: saved, phase: "error", reportId: "" });
    return;
  }
  if (isPendingJobId(saved.jobId) || saved.phase === "submitting") {
    const started = Number(saved.jobId.replace(/^pending-/, ""));
    // 15 min: phone uploads + GPU receive can exceed 3 min; 3 min false-fired
    // "Submit timed out" while UI still showed 服务器接收中.
    if (Number.isFinite(started) && Date.now() - started > 15 * 60 * 1000) {
      const next = { ...saved, phase: "error" as const, error: "error.submitTimeout" };
      writeActiveJob(next);
      setState({ job: next, phase: "error", reportId: "" });
      return;
    }
    setState({ job: saved, phase: "submitting", reportId: "" });
    return;
  }
  if (watchingId === saved.jobId && (state.phase === "running" || state.phase === "submitting")) return;
  void watchJob(saved);
}

export function startJobWatch(next: ActiveJob) {
  const stamped = { ...next, coachId: next.coachId || readCoachId() };
  writeActiveJob(stamped);
  void watchJob(stamped);
}

export function ackJobWatch() {
  if (state.phase === "done") setState(idle);
}

async function watchJob(saved: ActiveJob) {
  if (isPendingJobId(saved.jobId)) {
    setState({ job: saved, phase: "submitting", reportId: "" });
    return;
  }
  if (watchingId === saved.jobId && generation > 0 && (state.phase === "running" || state.phase === "submitting")) {
    return;
  }
  const gen = ++generation;
  watchingId = saved.jobId;
  setState({ job: saved, phase: saved.phase === "error" ? "error" : "running", reportId: "" });
  for (let i = 0; i < ANALYZE_POLL_TRIES; i += 1) {
    if (gen !== generation) return;
    try {
      const response = await taiFetch(`/api/jobs/${saved.jobId}`, { timeoutMs: 60_000 });
      if (gen !== generation) return;
      const job = (await response.json().catch(() => null)) as AlgoJob | null;
      if (!response.ok || !job) {
        const message = "job.gone";
        const next = { ...saved, phase: "error" as const, error: message, job };
        writeActiveJob(next);
        setState({ job: next, phase: "error", reportId: "" });
        watchingId = "";
        return;
      }
      const running: ActiveJob = {
        ...saved,
        phase: "running",
        job,
        title: saved.title || analysisTitle(findStroke(saved.strokeId)?.label || "Stroke", saved.fileName),
      };
      writeActiveJob(running);
      setState({ job: running, phase: "running", reportId: "" });
      if (job.status === "done") {
        await finishJob(running, gen);
        return;
      }
      if (job.status === "error" || job.status === "cancelled") {
        const message =
          job.message && !/[\u4e00-\u9fff]/.test(job.message)
            ? job.message
            : "job.failSide";
        const next = { ...running, phase: "error" as const, error: message, job };
        writeActiveJob(next);
        setState({ job: next, phase: "error", reportId: "" });
        watchingId = "";
        return;
      }
    } catch {
      /* keep polling; the server job is still running */
    }
    await new Promise((resolve) => window.setTimeout(resolve, ANALYZE_POLL_MS));
  }
  if (gen !== generation) return;
  const timeout: ActiveJob = {
    ...saved,
    phase: "error",
    error: "job.timeout",
  };
  writeActiveJob(timeout);
  setState({ job: timeout, phase: "error", reportId: "" });
  watchingId = "";
}

async function finishJob(saved: ActiveJob, gen: number) {
  if (gen !== generation) return;
  const existing = findReport(saved.jobId);
  if (existing) {
    clearActiveJob(saved.jobId);
    watchingId = "";
    setState({ job: null, phase: "done", reportId: saved.jobId });
    return;
  }
  const response = await taiFetch(`/api/jobs/${saved.jobId}/report`, { timeoutMs: 60_000 });
  if (gen !== generation) return;
  const report = (await response.json().catch(() => null)) as AlgoReport | null;
  if (!response.ok || !report) {
    const next = { ...saved, phase: "error" as const, error: "job.notReady" };
    writeActiveJob(next);
    setState({ job: next, phase: "error", reportId: "" });
    watchingId = "";
    return;
  }
  const media = mediaFromAlgo(report, saved.jobId);
  const stroke = findStroke(saved.strokeId);
  const level = findLevel(saved.levelId);
  addStoredReport({
    id: saved.jobId,
    title: preferredTitle(stroke?.label || "Stroke", saved.fileName || saved.title, report.title),
    when: stampWhen(report.generated_at || report.created_at),
    rating: report.overall?.grade || String(report.overall?.score ?? "—"),
    score: typeof report.overall?.score === "number" ? report.overall.score : Number(report.overall?.score) || null,
    grade: report.overall?.grade_label || report.overall?.grade || "",
    swings: typeof report.overall?.n_swings === "number" ? report.overall.n_swings : Number(report.overall?.n_swings) || null,
    summary: reportSummary(report),
    findings: reportFindings(report),
    videoName: saved.fileName,
    videoUrl: appClipUrl(saved.jobId),
    overlayUrl: media.overlayUrl,
    sourceUrl: media.sourceUrl,
    posterUrl: media.posterUrl,
    coverUrl: media.coverUrl,
    previewUrl: media.previewUrl,
    actionFrameUrl: media.actionFrameUrl,
    strokeId: media.strokeId || saved.strokeId || "",
    levelId: saved.levelId || "",
    levelLabel: level ? level.ntrp : "",
    strokeLabel: stroke?.label || "",
    detectRate: media.detectRate,
    status: "done",
    coachId: saved.coachId || readCoachId(),
    scores: Object.fromEntries(parseAxisScores(report.overall?.scores).map((row) => [row.key, row.value])),
  });
  clearActiveJob(saved.jobId);
  watchingId = "";
  setState({ job: null, phase: "done", reportId: saved.jobId });
}
