"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AnalyzeProgress } from "@/components/analyze-progress";
import {
  analysisTitle,
  findStroke,
  strokeTypes} from "@/lib/analysis";
import { platformStarDemoSync } from "@/lib/coach-library-analysis-hook";
import { ackJobWatch, ensureJobWatch, getJobWatch, markSubmitting, startJobWatch, subscribeJobWatch } from "@/lib/job-watch";
import type { JobProgressFields } from "@/lib/job-progress";
import { persistClipBlob, uploadAppClip } from "@/lib/report-media";
import { MIN_PLAYABLE_BYTES } from "@/lib/clip-quality";
import { apiErrorMessage } from "@/lib/api-error";
import { clearActiveJob } from "@/lib/active-job";
import { pingTai, taiFetch } from "@/lib/tai";
import { pageClass } from "@/lib/data";
import { readCoachId } from "@/lib/coach-roster";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { localizeJobError, strokeName } from "@/lib/i18n/translate";
import { VideoTrimmer } from "@/components/video-trimmer";
import { StarDemoPlayer } from "@/components/star-demo-player";

type Screen = "home" | "wizard";
type Phase = "idle" | "submitting" | "running" | "done" | "error";

export function AnalysisView() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>("wizard");
  const [strokeId, setStrokeId] = useState<string | null>(null);
  const [strokeError, setStrokeError] = useState("");
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [formError, setFormError] = useState("");
  const [jobSnap, setJobSnap] = useState<JobProgressFields | null>(null);
  const [strokeOpen, setStrokeOpen] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState("");

  const stroke = findStroke(strokeId);
  const exampleStrokeId = (stroke?.id || "fh-topspin") as string;
  const starDemo = platformStarDemoSync(exampleStrokeId);
  const analyzing = phase === "submitting" || phase === "running";

  function clearSource() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl("");
    setClipFile(null);
  }

  function pickSource(file: File) {
    if (!readyToUpload()) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setFormError("");
    setPhase("idle");
  }

  function startNewAnalysis() {
    setScreen("wizard");
    setStrokeId(null);
    setStrokeError("");
    setStrokeOpen(false);
    setPhase("idle");
    setFormError("");
    setJobSnap(null);
    setFileName("");
    clearSource();
  }

  function backToReports() {
    if (phase === "submitting") return;
    router.replace("/analysis");
  }

  function readyToUpload() {
    let ok = true;
    if (!strokeId) {
      setStrokeError(t("analysis.chooseStroke"));
      ok = false;
    } else {
      setStrokeError("");
    }
    return ok;
  }

  function handOffClip(file: File) {
    setClipFile(file);
    void submitVideo(file);
  }

  function failClip(message: string) {
    setPhase("error");
    setFormError(message);
    setJobSnap(null);
  }

  useEffect(() => {
    ensureJobWatch();
    const sync = () => {
      const live = getJobWatch();
      if (live.phase === "running" || live.phase === "submitting") {
        const saved = live.job;
        if (saved) {
          setActiveJobId(saved.jobId);
          if (saved.strokeId) setStrokeId(saved.strokeId);
          if (saved.fileName) setFileName(saved.fileName);
          setJobSnap(saved.job || null);
        }
        setPhase(live.phase);
        return;
      }
      if (live.phase === "error" && live.job) {
        setActiveJobId(live.job.jobId);
        setPhase("error");
        setFormError(localizeJobError(locale, live.job.error, "report.failedTitle"));
        setJobSnap(live.job.job || null);
        return;
      }
      if (live.phase === "done" && live.reportId) {
        const reportId = live.reportId;
        ackJobWatch();
        setPhase("done");
        setActiveJobId("");
        router.replace(`/report/${reportId}?from=analysis`);
      }
    };
    sync();
    return subscribeJobWatch(sync);
  }, [router]);

  useEffect(() => {
    if (!analyzing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [analyzing]);

  async function submitVideo(file: File) {
    if (!stroke) {
      setFormError(t("analysis.cantUpload"));
      readyToUpload();
      return;
    }
    if (file.size < MIN_PLAYABLE_BYTES) {
      setPhase("error");
      setFormError(t("analysis.noPictureAfterConvert"));
      return;
    }
    setClipFile(file);
    setFileName(file.name);
    setFormError("");
    setPhase("submitting");
    setJobSnap(null);
    markSubmitting({
      jobId: `pending-${Date.now()}`,
      levelId: "",
      strokeId: stroke.id,
      fileName: file.name,
      title: analysisTitle(stroke.label, file.name),
      coachId: readCoachId()});
    const health = await pingTai().catch(() => ({ ok: false, busy: false }));
    if (!health.ok) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("analysis.serviceDown"));
      return;
    }
    // Single GPU worker: uploading while busy makes phones wait then abort (499 → 超时).
    if (health.busy) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("error.busy"));
      return;
    }
    const body = new FormData();
    const clipName = file.name.toLowerCase().endsWith(".mp4") ? file.name : `${file.name.replace(/\.[^.]+$/, "") || "clip"}.mp4`;
    body.append("video", file, clipName);
    body.append("level", "");
    body.append("stroke", stroke.apiStroke);
    body.append("title", analysisTitle(stroke.label, file.name));
    body.append("sample", "0");
    try {
      const response = await taiFetch("/api/analyze", { method: "POST", body, timeoutMs: 900_000 });
      const payload = (await response.json().catch(() => null)) as unknown;
      const jobId =
        payload && typeof payload === "object" && "job_id" in payload
          ? String((payload as { job_id?: string }).job_id || "")
          : "";
      if (!response.ok || !jobId) {
        clearActiveJob();
        setPhase("error");
        setFormError(apiErrorMessage(payload, t("analysis.submitFail"), response.status, locale));
        return;
      }
      setActiveJobId(jobId);
      startJobWatch({
        jobId,
        levelId: "",
        strokeId: stroke.id,
        fileName: file.name,
        title: analysisTitle(stroke.label, file.name),
        phase: "running",
        coachId: readCoachId()});
      setPhase("running");
      void persistClipBlob(jobId, file).then((ok) => {
        if (ok) return uploadAppClip(jobId, file);
        return false;
      });
    } catch (error) {
      clearActiveJob();
      setPhase("error");
      setFormError(error instanceof Error && error.message ? localizeJobError(locale, error.message) : t("analysis.networkDropped"));
    }
  }

  return (
    <div className={pageClass} data-page="analysis" data-job-id={activeJobId || undefined} data-analysis-screen={analyzing ? "progress" : "wizard"}>
      <div>
        <h1 className="text-base font-bold text-foreground">{t("analysis.title")}</h1>
        {analyzing ? null : (
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" data-action="new-analysis" onClick={startNewAnalysis} className="text-xs text-primary">
              {t("analysis.startOver")}
            </button>
            <button type="button" data-action="back-history" onClick={backToReports} className="text-xs text-primary">
              {t("report.back")}
            </button>
          </div>
        )}
      </div>

      <section className="space-y-3" data-flow="page" data-no-level="true">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t("analysis.stroke")}</h2>
          {strokeError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("analysis.cantUpload")}</AlertTitle>
              <AlertDescription>{strokeError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="relative">
            <button
              type="button"
              data-dropdown="technique"
              data-open={strokeOpen ? "true" : undefined}
              aria-expanded={strokeOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setStrokeOpen((open) => !open);
              }}
              className={cn(
                "flex h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-sm",
                strokeId ? "border-primary bg-primary-subtle text-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              <span>{stroke ? strokeName(locale, stroke.id, stroke.label) : t("analysis.chooseStroke")}</span>
              <ChevronDown className={cn("size-4 shrink-0", strokeOpen ? "rotate-180" : "")} />
            </button>
            {strokeOpen ? (
              <ul
                data-dropdown-list="technique"
                role="listbox"
                className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                {strokeTypes.map((item) => {
                  const selected = strokeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-stroke={item.id}
                        data-technique={item.label}
                        onClick={() => {
                          setStrokeId(item.id);
                          setStrokeError("");
                          setStrokeOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm",
                          selected ? "bg-primary-subtle font-semibold text-primary" : "text-foreground hover:bg-muted",
                        )}
                      >
                        {strokeName(locale, item.id, item.label)}
                        {selected ? <Check className="size-4" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3" data-flow="video">
        {phase === "submitting" || phase === "running" || phase === "done" ? (
          <AnalyzeProgress
            job={jobSnap ? { ...jobSnap, id: jobSnap.id || activeJobId } : activeJobId ? { id: activeJobId } : null}
            submitting={phase === "submitting"}
            localPreviewUrl={sourceUrl || null}
            taiBase="/tai"
            title={locale === "zh" ? "正在分析挥拍" : t("analysis.analyzing")}
          />
        ) : phase === "error" ? null : sourceFile && sourceUrl ? (
          <VideoTrimmer
            file={sourceFile}
            src={sourceUrl}
            onCancel={clearSource}
            onConfirm={handOffClip}
            onFail={failClip}
          />
        ) : (
          <>
            <figure
              data-example={exampleStrokeId}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div data-example={exampleStrokeId} data-demo-source={starDemo.source} data-star-credit={starDemo.credit}>
                <StarDemoPlayer
                  strokeId={exampleStrokeId}
                  locale={locale === "en" ? "en" : "zh"}
                  overrideEmbedUrl={starDemo.source === "coach" ? starDemo.embedUrl : undefined}
                  overrideCredit={starDemo.source === "coach" ? starDemo.credit : undefined}
                />
              </div>
            </figure>
            <div>
              <Button
                type="button"
                data-action="upload"
                onClick={() => {
                  if (!readyToUpload()) return;
                  inputRef.current?.click();
                }}
              >
                {fileName || t("analysis.upload")}
              </Button>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            pickSource(file);
          }}
        />

        {phase === "error" && formError ? (
          <>
            {jobSnap ? <AnalyzeProgress
              job={jobSnap ? { ...jobSnap, id: jobSnap.id || activeJobId } : null}
              submitting={false}
              localPreviewUrl={sourceUrl || null}
              taiBase="/tai"
              title={locale === "zh" ? "正在分析挥拍" : t("analysis.analyzing")}
            /> : null}
            <Alert variant="destructive">
            <AlertTitle>{t("report.failedTitle")}</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
            {clipFile ? (
              <Button type="button" className="mt-3" data-action="retry-analyze" onClick={() => void submitVideo(clipFile)}>
                {t("common.retry")}
              </Button>
            ) : (
              <Button
                type="button"
                className="mt-3"
                data-action="retry-upload"
                onClick={() => {
                  clearActiveJob(activeJobId);
                  setActiveJobId("");
                  setPhase("idle");
                  setFormError("");
                  setJobSnap(null);
                }}
              >
                {t("analysis.uploadAgain")}
              </Button>
            )}
          </Alert>
          </>
        ) : null}
      </section>
    </div>
  );
}
