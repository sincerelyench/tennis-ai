"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { VisualCoach } from "@/components/visual-coach";
import { ReportFourDim } from "@/components/report-four-dim";
import {
  addStoredReport,
  favoriteReports,
  findReport,
  historyReports,
  patchStoredReport,
  toggleFavorite,
  useReports,
} from "@/lib/report-store";
import { appClipUrl, mediaFromAlgo, rememberClipUrl, restoreClip } from "@/lib/report-media";
import { reportFindings } from "@/lib/reports";
import { displayReportTitle, displayUserText, displayWhen, isVagueWhen, preferredTitle, reportSummary, stampWhen } from "@/lib/analysis";
import { addCoachNote, pullCoachNotes, useCoachNotes } from "@/lib/coach-notes";
import type { CoachNote } from "@/lib/journey";
import { useSessionRole } from "@/lib/session-role";
import { pageClass } from "@/lib/data";
import { taiFetch } from "@/lib/tai";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { findCoach, readCoachId } from "@/lib/coach-roster";
import { parseAxisScores } from "@/lib/report-scores";
import { displayGrade, localizeFinding } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export function ReportView({ reportId, from = "analysis" }: { reportId: string; from?: "analysis" | "reports" }) {
  const reports = useReports();
  const notes = useCoachNotes();
  const session = useSessionRole();
  const { t, locale } = useI18n();
  const isCoach = session.role === "coach";
  const report =
    reports.find((item) => item.id === reportId) ||
    (reportId === "preview-form"
      ? {
          id: "preview-form",
          title: "Forehand topspin · preview",
          when: "",
          rating: "",
          score: 70,
          grade: "B",
          swings: 6,
          summary: "Preview of Correct form demos.",
          findings: ["Contact late", "Not enough shoulder turn"],
          scores: { 重心: 18, 击球点: 12, 动力链: 20, 击球效果: 20 },
          videoName: "preview.mp4",
          videoUrl: "",
          strokeId: "fh-topspin",
          favorite: false,
          status: "done" as const,
        }
      : null);
  const history = report ? historyReports(report.id) : [];
  const saved = favoriteReports();
  const listHref = "/analysis";

  useEffect(() => {
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(reportId)) return;
    let alive = true;
    void (async () => {
      try {
        const response = await taiFetch(`/api/jobs/${reportId}/report`, { timeoutMs: 60_000 });
        if (!response.ok) return;
        const data = (await response.json()) as {
          title?: string;
          overlay_video?: string;
          cover_image?: string;
          preview?: string;
          stroke_mode?: string;
          stroke_label?: string;
          player_level_label?: string;
          source_name?: string;
          detect_rate?: number | string;
          generated_at?: string;
          created_at?: string;
          overall?: { score?: number; grade?: string; grade_label?: string; n_swings?: number; scores?: Record<string, number> };
          summary?: string;
          coach?: { summary?: string; improvements?: string[] };
          improvements?: string[];
          caveats?: string[];
        };
        if (!alive) return;
        const media = mediaFromAlgo(data, reportId);
        const current = findReport(reportId);
        const clip = (await restoreClip(reportId)) || (current?.videoUrl?.startsWith("blob:") ? current.videoUrl : "");
        if (clip) rememberClipUrl(reportId, clip);
        if (!alive) return;
        const fields = {
          ...media,
          videoUrl: clip || current?.videoUrl || appClipUrl(reportId),
          overlayUrl: media.overlayUrl,
          sourceUrl: media.sourceUrl,
          posterUrl: media.posterUrl,
          coverUrl: media.coverUrl,
          previewUrl: media.previewUrl,
          actionFrameUrl: media.actionFrameUrl,
          strokeId: media.strokeId,
          levelLabel: data.player_level_label || current?.levelLabel || "",
          strokeLabel: data.stroke_label || current?.strokeLabel || "",
          detectRate: media.detectRate,
          ...(parseAxisScores(data.overall?.scores).length
            ? { scores: Object.fromEntries(parseAxisScores(data.overall?.scores).map((row) => [row.key, row.value])) }
            : {}),
          ...(isVagueWhen(current?.when) && (data.generated_at || data.created_at)
            ? { when: stampWhen(data.generated_at || data.created_at) }
            : {}),
        };
        if (current) {
          patchStoredReport(reportId, fields);
          return;
        }
        addStoredReport({
          id: reportId,
          title: preferredTitle(data.stroke_label || t("report.strokeFallback"), data.source_name || "clip.mp4", data.title),
          when: stampWhen(data.generated_at || data.created_at),
          rating: data.overall?.grade || String(data.overall?.score ?? "—"),
          score: typeof data.overall?.score === "number" ? data.overall.score : Number(data.overall?.score) || null,
          grade: data.overall?.grade_label || data.overall?.grade || "",
          swings: typeof data.overall?.n_swings === "number" ? data.overall.n_swings : Number(data.overall?.n_swings) || null,
          summary: reportSummary(data, locale),
          findings: reportFindings(data),
          videoName: data.source_name || "",
          status: "done",
          coachId: readCoachId(),
          scores: Object.fromEntries(parseAxisScores(data.overall?.scores).map((row) => [row.key, row.value])),
          ...fields,
        });
      } catch {
        /* keep local report */
      }
    })();
    return () => {
      alive = false;
    };
  }, [reportId]);

  const reportCoach = report ? findCoach(report.coachId) : null;
  const issueRows = report
    ? (report.findings || []).map((line) => localizeFinding(locale, line)).filter(Boolean)
    : [];
  const axisRows = report ? parseAxisScores(report.scores) : [];
  const leadText = report ? t("report.leadEmpty") : "";
  const reportNotes = report ? notes.filter((note) => note.reportId === report.id) : [];

  if (!report) {
    return (
      <div className={pageClass}>
        <EmptyState
          title={/^[a-zA-Z0-9_-]{6,64}$/.test(reportId) ? t("report.opening") : t("report.missing")}
          description={
            /^[a-zA-Z0-9_-]{6,64}$/.test(reportId)
              ? t("report.openingDesc")
              : t("report.missingDesc")
          }
        />
        <Link href={listHref} data-action="back-list" className="text-sm text-primary">
          {t("report.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <section className="space-y-3" data-section="body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={listHref} data-action="back-list" className="text-xs font-medium text-primary">
              {t("report.back")}
            </Link>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{t("report.crumb")}</p>
            <h1 className="mt-1 text-base font-bold text-foreground">{displayReportTitle(report, locale)}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{displayWhen(report.when, locale)}</p>
            {reportCoach ? (
              <p className="mt-1 text-xs font-semibold text-primary" data-report-coach={report.coachId}>
                {t("report.byCoach", { name: `${t(reportCoach.nameKey)} · ${t(reportCoach.shortKey)}` })}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant={report.favorite ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFavorite(report.id)}
          >
            <Star className={cn("size-4", report.favorite ? "fill-current" : "")} />
            {report.favorite ? t("report.saved") : t("report.favorite")}
          </Button>
        </div>

        {report.status === "failed" ? (
          <Alert variant="destructive">
            <AlertTitle>{t("report.failedTitle")}</AlertTitle>
            <AlertDescription>{displayUserText(report.summary, t("report.failedFallback"), locale)}</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{t("report.score")}</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-bold leading-none text-foreground">
                {report.score ?? "—"}
              </p>
              <div className="pb-0.5">
              <p className="text-lg font-semibold leading-none text-foreground">
                {displayGrade(locale, report.grade || report.rating)}
              </p>
                {typeof report.swings === "number" ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t("report.swings", { n: report.swings })}</p>
                ) : null}
              </div>
            </div>
            {leadText ? <p className="mt-3 text-sm leading-6 text-foreground">{leadText}</p> : null}
            <div className="mt-4" data-zq-four-dim="1">
              <ReportFourDim scores={report.scores} report={report} />
            </div>
            {axisRows.length ? (
              <div className="mt-4 overflow-x-auto" data-report-table="axes">
                <table className="w-full min-w-[240px] border-collapse text-sm">
                  <caption className="mb-2 text-left text-xs font-medium text-muted-foreground">
                    {t("report.axesTitle")}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-medium text-muted-foreground">{t("report.axisCol")}</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">{t("report.scoreCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {axisRows.map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 text-foreground">{t(row.labelKey)}</td>
                        <td className="py-2 text-right tabular-nums text-foreground">
                          {row.value} / {row.max}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {issueRows.length ? (
              <div className="mt-4 overflow-x-auto" data-report-table="issues">
                <table className="w-full min-w-[240px] border-collapse text-sm">
                  <caption className="mb-2 text-left text-xs font-medium text-muted-foreground">
                    {t("report.issuesTitle")}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="w-10 py-2 pr-3 font-medium text-muted-foreground">#</th>
                      <th className="py-2 font-medium text-muted-foreground">{t("report.issueCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.map((line, index) => (
                      <tr key={`${index}-${line}`} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">{index + 1}</td>
                        <td className="py-2 text-foreground">{line}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <Link
              href="/journey"
              data-action="open-journey"
              className="mt-3 inline-block text-xs font-medium text-primary"
            >
              {t("report.journeyLink")}
            </Link>
          </div>
        )}

        {report.status === "failed" ? null : <VisualCoach report={report} />}

        <CoachNoteBox reportId={report.id} strokeId={report.strokeId || ""} notes={reportNotes} canEdit={isCoach} />
      </section>

      <section className="space-y-3" data-section="history">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("report.history")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("report.historyLead")}</p>
        </div>
        {history.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {history.map((item, index) => (
              <Link
                key={item.id}
                href={`/report/${item.id}?from=${from}`}
                className={cn(
                  "flex items-center justify-between px-4 py-3 hover:bg-muted",
                  index === history.length - 1 ? "" : "border-b border-border",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{displayReportTitle(item, locale)}</p>
                  <p className="text-xs text-muted-foreground">{displayWhen(item.when, locale)}</p>
                </div>
                <span className={item.status === "failed" ? "text-sm font-bold text-destructive" : "text-sm font-bold"}>
                  {item.status === "failed" ? t("common.failed") : item.rating}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t("report.historyEmpty")} description={t("report.historyEmptyDesc")} />
        )}
      </section>

      <section className="space-y-3" data-section="favorites">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("report.savedTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("report.savedLead")}</p>
        </div>
        {saved.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {saved.map((item, index) => (
              <Link
                key={item.id}
                href={`/report/${item.id}?from=${from}`}
                className={cn(
                  "flex items-center justify-between px-4 py-3 hover:bg-muted",
                  index === saved.length - 1 ? "" : "border-b border-border",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{displayReportTitle(item, locale)}</p>
                  <p className="text-xs text-muted-foreground">{displayWhen(item.when, locale)}</p>
                </div>
                <span className="text-sm font-bold">{item.rating}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t("report.savedEmpty")} description={t("report.savedEmptyDesc")} />
        )}
      </section>
    </div>
  );
}

function CoachNoteBox({
  reportId,
  strokeId,
  notes,
  canEdit,
}: {
  reportId: string;
  strokeId: string;
  notes: CoachNote[];
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  useEffect(() => {
    void pullCoachNotes();
  }, []);
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-section="coach-note">
      <p className="text-xs font-semibold text-foreground">{t("coachNote.title")}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {canEdit ? t("coachNote.reportLead") : t("coachNote.viewLead")}
      </p>
      {notes.map((note) => (
        <div key={note.id} className="mt-3 rounded-md bg-muted px-3 py-2">
          <p className="text-[11px] font-semibold text-primary">
            {note.author} · {note.kind === "drill" ? t("common.drill") : t("common.note")} · {note.when}
          </p>
          <p className="mt-1 text-xs leading-5 text-foreground">{note.text}</p>
        </div>
      ))}
      {canEdit ? (
        <>
          <Textarea
            className="mt-3 min-h-16"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("coachNote.placeholder")}
          />
          <Button
            type="button"
            size="sm"
            className="mt-2"
            data-note-save={reportId}
            onClick={() => {
              if (addCoachNote({ reportId, strokeId, text, kind: "note" })) setText("");
            }}
          >
            {t("coachNote.saveCoach")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
