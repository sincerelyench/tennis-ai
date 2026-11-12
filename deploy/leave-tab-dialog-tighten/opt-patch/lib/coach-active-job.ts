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
/** Tab-session marker: pending uploads do not survive reload (XHR is dead). */
const UPLOAD_SESSION_KEY = "tennis-coach-upload-session-v1";
/** Drop stuck analyzing/submitting real jobs after this age. */
const STALE_JOB_MS = 45 * 60 * 1000;

function canUseStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function syncLockFlag(active: boolean) {
  if (!canUseStore()) return;
  try {
    window.localStorage.setItem(LOCK_KEY, active ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function markCoachUploadSession(jobId: string) {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
  try {
    window.sessionStorage.setItem(UPLOAD_SESSION_KEY, jobId);
  } catch {
    /* ignore */
  }
}

export function clearCoachUploadSession() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
  try {
    window.sessionStorage.removeItem(UPLOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function readUploadSession(): string {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return "";
  try {
    return window.sessionStorage.getItem(UPLOAD_SESSION_KEY) || "";
  } catch {
    return "";
  }
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
    const stamped = { ...next, updatedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(stamped));
    const inflight = stamped.phase === "submitting" || stamped.phase === "analyzing";
    window.localStorage.setItem(LOCK_KEY, inflight ? "1" : "0");
    if (String(stamped.jobId).startsWith("pending-") && stamped.phase === "submitting") {
      markCoachUploadSession(stamped.jobId);
    } else {
      // Real job id / done / error — upload XHR session no longer applies.
      clearCoachUploadSession();
    }
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
    clearCoachUploadSession();
    window.dispatchEvent(new Event("tennis-coach-job"));
  } catch {
    /* ignore */
  }
}

/**
 * Soft-nav leave lock: true ONLY while coach video bytes are uploading in this
 * tab session, or a real server job is analyzing/submitting. Idle / finished /
 * never-uploaded / orphan flags → false.
 */
export function isCoachSubmitLocked(): boolean {
  if (!canUseStore()) return false;
  try {
    const job = readCoachActiveJob();
    if (!job) {
      syncLockFlag(false);
      return false;
    }
    if (job.phase !== "submitting" && job.phase !== "analyzing") {
      syncLockFlag(false);
      return false;
    }

    const age = Date.now() - (typeof job.updatedAt === "number" ? job.updatedAt : 0);

    // pending-* means upload XHR in this page lifetime only.
    if (String(job.jobId).startsWith("pending-")) {
      if (readUploadSession() !== job.jobId) {
        clearCoachActiveJob(job.jobId);
        return false;
      }
      syncLockFlag(true);
      return true;
    }

    // Real job id — analyzing (or brief submitting after id assigned).
    if (age > STALE_JOB_MS) {
      clearCoachActiveJob(job.jobId);
      return false;
    }
    syncLockFlag(true);
    return true;
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
