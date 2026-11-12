"use client";

/**
 * Coach-tab video upload → tai/sslip analysis API (not iframe).
 * Parent receives finished guidance; analysis tab stays hidden.
 *
 * ZQ-87: do not mark the persisted job as error when this component
 * unmounts mid-poll (tab switch / leave page). Resume re-polls the
 * server job and re-applies guidance.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { VideoTrimmer } from "@/components/video-trimmer";
import {
  buildGuidanceBundle,
  COACH_VIDEO_STROKES,
  type CoachVideoResult,
  type GuidanceBundle,
} from "@/lib/coach-video-guidance";
import {
  clearCoachActiveJob,
  patchCoachActiveJob,
  readCoachActiveJob,
  writeCoachActiveJob,
} from "@/lib/coach-active-job";
import { ANALYZE_POLL_MS, ANALYZE_POLL_TRIES, pingTai, taiFetch, taiUpload } from "@/lib/tai";
import { cn } from "@/lib/utils";

type Phase = "idle" | "trim" | "uploading" | "analyzing" | "done" | "error";

type Props = {
  locale: "zh" | "en";
  disabled?: boolean;
  onGuidance: (bundle: GuidanceBundle, meta: { jobId: string; strokeId: string; fileName: string }) => void;
  className?: string;
};

type JobSnap = {
  id?: string;
  status?: string;
  progress?: number;
  message?: string;
  step_name?: string;
  score?: number;
};

const MIN_PLAYABLE_BYTES = 8_000;

function isTransientNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("uploadaborted") ||
    m.includes("error.uploadaborted") ||
    m.includes("load failed") ||
    m.includes("aborted") ||
    m.includes("network")
  );
}

export function CoachVideoUpload({ locale, disabled, onGuidance, className }: Props) {
  const zh = locale === "zh";
  const inputRef = useRef<HTMLInputElement>(null);
  /** Bumps only on explicit reset — never on unmount, so leave-page does not cancel. */
  const pollGen = useRef(0);
  const mounted = useRef(true);
  const onGuidanceRef = useRef(onGuidance);
  onGuidanceRef.current = onGuidance;

  const [strokeId, setStrokeId] = useState("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [jobSnap, setJobSnap] = useState<JobSnap | null>(null);
  const [jobId, setJobId] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Do NOT abort in-flight analyze / poll — server job must survive navigation.
      // Do NOT mark the persisted job as error here (ZQ-87).
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetToIdle() {
    pollGen.current += 1;
    clearCoachActiveJob();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl("");
    setClipFile(null);
    setFileName("");
    setJobSnap(null);
    setJobId("");
    setError("");
    setPhase("idle");
  }

  function pickSource(file: File) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    setSourceFile(file);
    setSourceUrl(url);
    setClipFile(null);
    setFileName(file.name);
    setError("");
    setJobSnap(null);
    setJobId("");
    setPhase("trim");
  }

  function fail(message: string, opts?: { keepJob?: boolean }) {
    // Leaving the page aborts in-flight fetch(); never poison a real server job.
    if (!mounted.current) {
      const active = readCoachActiveJob();
      if (active && !String(active.jobId).startsWith("pending-")) {
        patchCoachActiveJob({
          phase: "analyzing",
          message: zh ? "离开页面后分析仍在继续…" : "Analysis continues after leave…",
          error: undefined,
        });
      }
      return;
    }
    setError(message);
    setPhase("error");
    const active = readCoachActiveJob();
    if (!active) return;
    const realJob = !String(active.jobId).startsWith("pending-");
    if (realJob && isTransientNetworkError(message)) {
      // Keep analyzing so resume can re-poll the server job.
      patchCoachActiveJob({
        phase: "analyzing",
        message: zh ? "网络中断，返回后将继续查询…" : "Network blip — will resume on return…",
        error: undefined,
      });
      return;
    }
    patchCoachActiveJob({ phase: "error", error: message, message });
    if (!opts?.keepJob && String(active.jobId).startsWith("pending-")) {
      clearCoachActiveJob(active.jobId);
    }
  }

  async function pollUntilDone(id: string, gen: number, nameHint: string): Promise<CoachVideoResult | null> {
    for (let i = 0; i < ANALYZE_POLL_TRIES; i += 1) {
      if (pollGen.current !== gen) return null; // explicit reset only
      // Stop client poll on unmount; leave localStorage as analyzing for resume.
      if (!mounted.current) return null;
      let res: Response;
      try {
        res = await taiFetch(`/api/jobs/${id}`, { timeoutMs: 30_000 });
      } catch (err) {
        if (!mounted.current || pollGen.current !== gen) return null;
        throw err;
      }
      if (!mounted.current || pollGen.current !== gen) return null;
      const snap = (await res.json().catch(() => null)) as JobSnap | null;
      if (!res.ok || !snap) {
        throw new Error(zh ? "查询分析进度失败" : "Failed to poll analysis");
      }
      if (mounted.current) setJobSnap({ ...snap, id });
      patchCoachActiveJob({
        phase: "analyzing",
        progress: typeof snap.progress === "number" ? snap.progress : undefined,
        step_name: snap.step_name,
        message: snap.message,
        error: undefined,
      });
      const status = String(snap.status || "").toLowerCase();
      if (status === "done" || status === "finished" || Number(snap.progress) >= 100) {
        let resultRes: Response;
        try {
          resultRes = await taiFetch(`/api/jobs/${id}/result`, { timeoutMs: 60_000 });
        } catch (err) {
          if (!mounted.current || pollGen.current !== gen) return null;
          throw err;
        }
        if (!mounted.current || pollGen.current !== gen) return null;
        const result = (await resultRes.json().catch(() => null)) as CoachVideoResult & {
          job_id?: string;
          total?: number;
        } | null;
        if (!resultRes.ok || !result) {
          throw new Error(zh ? "读取分析结果失败" : "Failed to load analysis result");
        }
        return {
          jobId: String(result.job_id || id),
          stroke: result.stroke,
          total: result.total,
          grade: result.grade,
          focus: result.focus,
          axes: result.axes,
          sourceName: nameHint,
        };
      }
      if (status === "error" || status === "failed" || status === "cancelled") {
        throw new Error(snap.message || (zh ? "分析失败" : "Analysis failed"));
      }
      await new Promise((r) => setTimeout(r, ANALYZE_POLL_MS));
    }
    throw new Error(zh ? "分析超时，请稍后重试" : "Analysis timed out");
  }

  async function finishWithResult(
    id: string,
    result: CoachVideoResult,
    meta: { strokeId: string; fileName: string; locale?: "zh" | "en" },
  ) {
    const bundleLocale = meta.locale || readCoachActiveJob()?.locale || locale;
    const bundle = buildGuidanceBundle(result, {
      locale: bundleLocale,
      pickerId: meta.strokeId === "auto" ? null : meta.strokeId,
      fileName: meta.fileName,
    });
    // Always deliver guidance to parent (and persisted history) even if this
    // instance briefly remounts; clear job only after apply.
    onGuidanceRef.current(bundle, { jobId: id, strokeId: meta.strokeId, fileName: meta.fileName });
    clearCoachActiveJob(id);
    if (mounted.current) {
      setPhase("done");
      setJobId(id);
      setJobSnap({
        id,
        progress: 100,
        status: "done",
        step_name: zh ? "教练点评" : "Coaching",
        message: zh ? "分析完成" : "Done",
        score: result.total ?? undefined,
      });
    }
  }

  async function submitClip(file: File) {
    if (file.size < MIN_PLAYABLE_BYTES) {
      fail(zh ? "视频太小或已损坏，请换一段再试" : "Clip is too small or damaged");
      return;
    }
    setClipFile(file);
    setFileName(file.name);
    setError("");
    const gen = pollGen.current;
    const pendingId = `pending-${Date.now()}`;
    setPhase("uploading");
    setJobSnap({ progress: 2, step_name: zh ? "提交" : "Submit", message: zh ? "正在上传视频…" : "Uploading…" });
    writeCoachActiveJob({
      jobId: pendingId,
      strokeId,
      fileName: file.name,
      phase: "submitting",
      locale,
      progress: 2,
      step_name: zh ? "提交" : "Submit",
      message: zh ? "正在上传视频…" : "Uploading…",
      updatedAt: Date.now(),
    });

    const health = await pingTai().catch(() => ({ ok: false, busy: false }));
    if (!health.ok) {
      fail(zh ? "分析服务暂时不可用，请稍后再试" : "Analysis service is unavailable");
      return;
    }
    if (health.busy) {
      fail(zh ? "分析队列已满，请稍后再试" : "Analysis queue is full — try again shortly");
      return;
    }

    const strokeMeta = COACH_VIDEO_STROKES.find((s) => s.id === strokeId) || COACH_VIDEO_STROKES[0];
    const body = new FormData();
    const clipName = file.name.toLowerCase().endsWith(".mp4")
      ? file.name
      : `${file.name.replace(/\.[^.]+$/, "") || "clip"}.mp4`;
    body.append("video", file, clipName);
    body.append("level", "");
    body.append("stroke", strokeMeta.apiStroke);
    body.append("title", zh ? `教练指导 · ${strokeMeta.labelZh}` : `Coach guidance · ${strokeMeta.labelEn}`);
    body.append("sample", "0");
    body.append("fast", "1");

    try {
      // No AbortSignal — soft nav / remount must not kill the upload XHR.
      const response = await taiUpload("/api/analyze", body, {
        timeoutMs: 900_000,
        onProgress: (loaded, total) => {
          const ratio = total > 0 ? loaded / total : 0;
          const progress = Math.max(2, Math.min(28, Math.round(2 + ratio * 26)));
          const message =
            ratio >= 0.999 ? (zh ? "服务器接收中…" : "Server receiving…") : zh ? "正在上传视频…" : "Uploading…";
          if (mounted.current) {
            setJobSnap({
              progress,
              step_name: zh ? "提交" : "Submit",
              message,
            });
          }
          patchCoachActiveJob({ phase: "submitting", progress, step_name: zh ? "提交" : "Submit", message });
        },
      });
      if (pollGen.current !== gen) return;
      if (!mounted.current) {
        // Upload response may still arrive after leave; persist job id for resume.
      }
      const payload = (await response.json().catch(() => null)) as {
        job_id?: string;
        detail?: string;
        code?: string;
        analyze_mode?: string;
        cached?: boolean;
        report?: unknown;
      } | null;
      const id = payload?.job_id ? String(payload.job_id) : "";
      if (!response.ok || !id) {
        fail(
          (payload && typeof payload.detail === "string" && payload.detail) ||
            (zh ? "提交失败，请重试" : "Submit failed — retry"),
        );
        return;
      }
      if (mounted.current) {
        setJobId(id);
        setPhase("analyzing");
        setJobSnap({
          id,
          progress: 30,
          step_name: zh ? "识别动作" : "Detect",
          message: zh ? "AI 教练正在看视频…" : "AI Coach is watching…",
        });
      }
      writeCoachActiveJob({
        jobId: id,
        strokeId,
        fileName: file.name,
        phase: "analyzing",
        locale,
        progress: 30,
        step_name: zh ? "识别动作" : "Detect",
        message: zh ? "AI 教练正在看视频…" : "AI Coach is watching…",
        updatedAt: Date.now(),
      });

      if (payload?.cached && payload.report) {
        // rare inline cache — still fetch /result for coach bundle shape
      }
      if (!mounted.current) {
        // Leave page mid-upload after job_id: stop here; resume will poll.
        return;
      }
      const result = await pollUntilDone(id, gen, file.name);
      if (!result || pollGen.current !== gen) return;
      await finishWithResult(id, result, { strokeId, fileName: file.name, locale });
    } catch (err) {
      if (pollGen.current !== gen) return;
      if (!mounted.current) {
        const active = readCoachActiveJob();
        if (active && !String(active.jobId).startsWith("pending-")) {
          patchCoachActiveJob({
            phase: "analyzing",
            message: zh ? "离开页面后分析仍在继续…" : "Analysis continues after leave…",
            error: undefined,
          });
        }
        return;
      }
      const msg =
        err instanceof Error && err.message
          ? err.message
          : zh
            ? "网络中断，请重试"
            : "Network error — retry";
      const active = readCoachActiveJob();
      if (active && !String(active.jobId).startsWith("pending-")) {
        fail(msg, { keepJob: true });
      } else {
        fail(msg);
      }
    }
  }

  // Resume in-flight / completed coach analyze after leave + return.
  useEffect(() => {
    const active = readCoachActiveJob();
    if (!active || String(active.jobId).startsWith("pending-")) return;

    const canResume =
      active.phase === "analyzing" ||
      active.phase === "done" ||
      active.phase === "submitting" ||
      // Heal ZQ-87: prior leave marked transient "Failed to fetch" as error.
      (active.phase === "error" &&
        (!active.error || isTransientNetworkError(String(active.error || active.message || ""))));

    if (!canResume) {
      if (active.phase === "error") {
        setError(active.error || active.message || (zh ? "分析失败" : "Analysis failed"));
        setPhase("error");
        setJobId(active.jobId);
        setStrokeId(active.strokeId || "auto");
        setFileName(active.fileName || "");
      }
      return;
    }

    const gen = pollGen.current;
    setStrokeId(active.strokeId || "auto");
    setFileName(active.fileName || "");
    setJobId(active.jobId);
    setError("");
    setPhase("analyzing");
    setJobSnap({
      id: active.jobId,
      progress: active.progress ?? 30,
      step_name: active.step_name || (zh ? "识别动作" : "Detect"),
      message: active.message || (zh ? "正在恢复分析…" : "Resuming analysis…"),
    });
    patchCoachActiveJob({
      phase: "analyzing",
      error: undefined,
      message: active.message || (zh ? "正在恢复分析…" : "Resuming analysis…"),
    });
    void (async () => {
      try {
        const result = await pollUntilDone(active.jobId, gen, active.fileName || "");
        if (!result || pollGen.current !== gen) return;
        await finishWithResult(active.jobId, result, {
          strokeId: active.strokeId || "auto",
          fileName: active.fileName || "",
          locale: active.locale || locale,
        });
      } catch (err) {
        if (pollGen.current !== gen) return;
        if (!mounted.current) {
          patchCoachActiveJob({
            phase: "analyzing",
            message: zh ? "离开页面后分析仍在继续…" : "Analysis continues after leave…",
            error: undefined,
          });
          return;
        }
        const msg =
          err instanceof Error && err.message
            ? err.message
            : zh
              ? "恢复分析失败"
              : "Failed to resume analysis";
        fail(msg, { keepJob: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase === "uploading" || phase === "analyzing";
  const progressLabel = jobSnap
    ? `${jobSnap.step_name || ""}${jobSnap.progress != null ? ` · ${jobSnap.progress}%` : ""}${
        jobSnap.message ? ` — ${jobSnap.message}` : ""
      }`
    : zh
      ? "处理中…"
      : "Working…";

  return (
    <section
      className={cn("space-y-3 rounded-lg border border-border bg-card px-3 py-3", className)}
      data-coach-video-guidance="true"
      data-coach-persist="1"
      data-coach-guidance-fix="zq87"
      data-phase={phase}
      data-job-id={jobId || undefined}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">
          {zh ? "上传视频求指导" : "Upload a clip for coaching"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {zh
            ? "AI 教练会立刻根据分析给意见；同时发给你选择的网络教练留言求指导。选段约 10 秒。"
            : "AI Coach replies from analysis; the same clip is also sent to your network coach. Trim ≈ 10s."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="coach-video-stroke">
          {zh ? "技术动作" : "Stroke"}
        </label>
        <select
          id="coach-video-stroke"
          data-coach-video-stroke="true"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={strokeId}
          disabled={busy || disabled}
          onChange={(e) => setStrokeId(e.target.value)}
        >
          {COACH_VIDEO_STROKES.map((s) => (
            <option key={s.id} value={s.id}>
              {zh ? s.labelZh : s.labelEn}
            </option>
          ))}
        </select>
      </div>

      {phase === "idle" ? (
        <EmptyState
          title={zh ? "还没有上传视频" : "No clip yet"}
          description={zh ? "选一段侧面挥拍，约 10 秒，全身入镜。" : "Pick a side-view swing, about 10 seconds, full body in frame."}
        >
          <Button
            type="button"
            data-action="coach-video-pick"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {zh ? "选择视频" : "Choose video"}
          </Button>
        </EmptyState>
      ) : null}

      {phase === "trim" && sourceFile && sourceUrl ? (
        <VideoTrimmer
          file={sourceFile}
          src={sourceUrl}
          onCancel={resetToIdle}
          onConfirm={(clip) => void submitClip(clip)}
          onFail={(message) => fail(message)}
        />
      ) : null}

      {busy ? (
        <div className="space-y-2" data-coach-video-progress="true">
          <LoadingState label={progressLabel} />
          <p className="text-xs text-muted-foreground">
            {zh
              ? "上传完成前请尽量留在本页；分析开始后可离开，回来仍会继续进度或结果。"
              : "Stay until upload finishes; after analysis starts you can leave and resume progress or the result on return."}
          </p>
        </div>
      ) : null}

      {phase === "done" && jobId ? (
        <div
          className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
          data-coach-video-done="true"
        >
          <p className="font-semibold text-primary">
            {zh ? "指导已写入下方" : "Guidance posted below"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {zh ? `任务 ${jobId}${jobSnap?.score != null ? ` · 得分 ${jobSnap.score}` : ""}` : `Job ${jobId}${jobSnap?.score != null ? ` · score ${jobSnap.score}` : ""}`}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2" data-action="coach-video-again" onClick={resetToIdle}>
            {zh ? "再传一段" : "Upload another"}
          </Button>
        </div>
      ) : null}

      {phase === "error" ? (
        <EmptyState title={zh ? "上传或分析失败" : "Upload or analysis failed"} description={error || (zh ? "请重试" : "Please retry")}>
          <div className="flex flex-wrap gap-2">
            {clipFile ? (
              <Button type="button" data-action="coach-video-retry" onClick={() => void submitClip(clipFile)}>
                {zh ? "重试分析" : "Retry analysis"}
              </Button>
            ) : jobId ? (
              <Button
                type="button"
                data-action="coach-video-resume"
                onClick={() => {
                  writeCoachActiveJob({
                    jobId,
                    strokeId,
                    fileName: fileName || "clip.mp4",
                    phase: "analyzing",
                    locale,
                    progress: 30,
                    step_name: zh ? "识别动作" : "Detect",
                    message: zh ? "正在恢复分析…" : "Resuming analysis…",
                    updatedAt: Date.now(),
                  });
                  setError("");
                  setPhase("analyzing");
                  const gen = ++pollGen.current;
                  void (async () => {
                    try {
                      const result = await pollUntilDone(jobId, gen, fileName || "");
                      if (!result || pollGen.current !== gen) return;
                      await finishWithResult(jobId, result, { strokeId, fileName: fileName || "" });
                    } catch (err) {
                      const msg =
                        err instanceof Error && err.message
                          ? err.message
                          : zh
                            ? "恢复分析失败"
                            : "Failed to resume analysis";
                      fail(msg, { keepJob: true });
                    }
                  })();
                }}
              >
                {zh ? "继续查询结果" : "Resume result"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" data-action="coach-video-reset" onClick={resetToIdle}>
              {zh ? "重新选择" : "Choose again"}
            </Button>
          </div>
        </EmptyState>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        data-coach-video-input="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          pickSource(file);
        }}
      />
    </section>
  );
}
