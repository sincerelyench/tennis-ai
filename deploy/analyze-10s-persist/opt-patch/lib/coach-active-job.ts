/**
 * Persist coach「视频指导」analyze jobs across soft navigation / remount.
 * Separate from analysis-tab `tennis-active-job-v1` so job-watch does not
 * steal the result into /report.
 */

export type CoachActiveJob = {
  jobId: string;
  strokeId: string;
  fileName: string;
  phase: "submitting" | "analyzing" | "done" | "error";
  locale?: "zh" | "en";
  progress?: number;
  step_name?: string;
  message?: string;
  error?: string;
  updatedAt: number;
};

const KEY = "tennis-coach-active-job-v1";
const LOCK_KEY = "tennis-coach-submit-lock-v1";

function canUseStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCoachActiveJob(): CoachActiveJob | null {
  if (!canUseStore()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoachActiveJob;
    if (!parsed || typeof parsed.jobId !== "string" || !parsed.jobId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCoachActiveJob(next: CoachActiveJob) {
  if (!canUseStore() || !next.jobId) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...next, updatedAt: Date.now() }));
    window.localStorage.setItem(LOCK_KEY, next.phase === "submitting" || next.phase === "analyzing" ? "1" : "0");
    window.dispatchEvent(new Event("tennis-coach-job"));
  } catch {
    /* ignore quota */
  }
}

export function patchCoachActiveJob(partial: Partial<CoachActiveJob>) {
  const current = readCoachActiveJob();
  if (!current) return;
  writeCoachActiveJob({ ...current, ...partial, jobId: partial.jobId || current.jobId });
}

export function clearCoachActiveJob(jobId?: string) {
  if (!canUseStore()) return;
  if (jobId) {
    const current = readCoachActiveJob();
    if (current && current.jobId !== jobId) return;
  }
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.setItem(LOCK_KEY, "0");
    window.dispatchEvent(new Event("tennis-coach-job"));
  } catch {
    /* ignore */
  }
}

/** Soft-nav lock while coach upload/analyze is in flight (app-shell). */
export function isCoachSubmitLocked(): boolean {
  if (!canUseStore()) return false;
  try {
    if (window.localStorage.getItem(LOCK_KEY) === "1") return true;
    const job = readCoachActiveJob();
    return !!job && (job.phase === "submitting" || job.phase === "analyzing");
  } catch {
    return false;
  }
}

export function subscribeCoachJob(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === KEY || e.key === LOCK_KEY) listener();
  };
  window.addEventListener("tennis-coach-job", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("tennis-coach-job", listener);
    window.removeEventListener("storage", onStorage);
  };
}
