"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { pageClass } from "@/lib/data";
import { useEffect } from "react";
import { AnalyzeProgress } from "@/components/analyze-progress";
import { ackJobWatch, ensureJobWatch, getJobWatch, subscribeJobWatch } from "@/lib/job-watch";
import { useReports } from "@/lib/report-store";
import { refreshVagueReportTimes } from "@/lib/report-times";
import { displayLevel, displayReportTitle, displayUserText, displayWhen, strokeLabelFrom } from "@/lib/analysis";
import { useI18n } from "@/components/i18n-provider";
import { strokeName } from "@/lib/i18n/translate";

export function ReportsView({ variant = "reports" }: { variant?: "analysis" | "reports" }) {
  const reports = useReports();
  const router = useRouter();
  const { t, locale } = useI18n();
  const zh = locale !== "en";
  const from = variant === "analysis" ? "analysis" : "reports";
  const live = useSyncExternalStore(subscribeJobWatch, getJobWatch, getJobWatch);
  const runningLive = live.phase === "running" || live.phase === "submitting" ? live.job : null;
  useEffect(() => {
    ensureJobWatch();
  }, []);
  useEffect(() => {
    if (variant === "analysis" && (live.phase === "running" || live.phase === "submitting")) {
      router.replace("/analysis/new");
    }
  }, [live.phase, router, variant]);
  useEffect(() => {
    if (live.phase === "done") ackJobWatch();
  }, [live.phase]);
  useEffect(() => {
    void refreshVagueReportTimes();
  }, []);

  return (
    <div
      className={pageClass}
      data-page={variant === "analysis" ? "analysis" : "reports"}
      data-analysis-screen={variant === "analysis" ? "list" : undefined}
      data-zq-match-entry="1"
    >
      <div>
        <h1 className="text-base font-bold text-foreground">{t("analysis.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("analysis.lead")}</p>
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/analysis/new"
              data-action="new-analysis"
              className={cn(buttonVariants(), "h-10")}
            >
              {t("analysis.new")}
            </Link>
            <Link
              href="/analysis/match"
              data-action="match-record"
              className={cn(buttonVariants({ variant: "outline" }), "h-10")}
            >
              {zh ? "比赛录制 / 分析" : "Match record / analyze"}
            </Link>
            <Link
              href="/journey"
              data-action="open-journey"
              className={cn(buttonVariants({ variant: "outline" }), "h-10")}
            >
              {t("journey.title")}
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground" data-match-entry-hint="true">
            {zh
              ? "比赛录制：整场录像、剪空镜、计分条、球速热力与涨球教练赛后点评。挥拍技术分析不变。"
              : "Match record: full match, trim dead time, score bar, speed/heatmap, Zhangqiu Coach notes. Stroke analyze unchanged."}
          </p>
        </div>
      </div>

      {runningLive && variant !== "analysis" ? (
        <div data-action="resume-job">
          <AnalyzeProgress
            job={
              runningLive.job
                ? { ...runningLive.job, id: runningLive.job.id || runningLive.jobId }
                : { id: runningLive.jobId }
            }
            submitting={live.phase === "submitting"}
            taiBase="/tai"
            title={t("analysis.analyzing")}
          />
        </div>
      ) : null}

      {reports.length ? (
        <section className="space-y-2" data-section="history" data-history-list="true">
          <h1 className="text-base font-bold text-foreground" data-history-title="true">
            {t("analysis.reports")}
          </h1>
          {reports.map((report) => {
            const stroke = strokeName(locale, report.strokeId, report.strokeLabel || strokeLabelFrom(report.strokeId, report.title));
            const level = report.status === "failed" ? t("common.failed") : displayLevel(locale, report.levelId, report.levelLabel);
            const score = report.score == null ? "—" : String(report.score);
            if (report.status === "failed") {
              return (
                <Alert key={report.id} variant="destructive" data-history-item={report.id}>
                  <AlertTitle>
                    {displayReportTitle(report, locale)} · {displayWhen(report.when, locale)}
                  </AlertTitle>
                  <AlertDescription>{displayUserText(report.summary, t("report.failedFallback"), locale)}</AlertDescription>
                  <Link href="/analysis/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
                    {t("report.analyzeAgain")}
                  </Link>
                </Alert>
              );
            }
            return (
              <Link
                key={report.id}
                href={`/report/${report.id}?from=${from}`}
                data-history-item={report.id}
                data-report-when={report.when}
                data-report-score={score}
                data-report-level={level}
                data-report-stroke={stroke}
                className="block rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted"
              >
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{t("report.analyzed")}</p>
                    <p className="truncate text-sm font-medium text-foreground">{displayWhen(report.when, locale)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{t("report.score")}</p>
                    <p className="truncate text-sm font-medium text-foreground">{score}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{t("analysis.level")}</p>
                    <p className="truncate text-sm font-medium text-foreground">{level}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{t("analysis.stroke")}</p>
                    <p className="truncate text-sm font-medium text-foreground">{stroke}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <div data-section="history" data-history-empty="true" className="space-y-2">
          <h1 className="text-base font-bold text-foreground" data-history-title="true">
            {t("analysis.reports")}
          </h1>
          <EmptyState title={t("analysis.emptyTitle")} description={t("analysis.emptyDesc")} />
        </div>
      )}
    </div>
  );
}
