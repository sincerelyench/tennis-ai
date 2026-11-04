"use client";

import { useEffect, useMemo, useState } from "react";
import { DemoPlayer } from "@/components/demo-player";
import { ReportPlayer } from "@/components/report-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDemoExtra, mergeServerDemos, useDemoExtras } from "@/lib/demo-extras";
import {
  builtInDemosFor,
  sortDemos,
  strokeKeyFrom,
  type DemoPlatform,
  type StrokeDemoItem,
} from "@/lib/demo-catalog";
import { formatCount } from "@/lib/role";
import { useSessionRole } from "@/lib/session-role";
import { problemMarks } from "@/lib/visual-coach";
import { useI18n } from "@/components/i18n-provider";
import { platformName } from "@/lib/i18n/translate";
import { platformDemosFor } from "@/lib/coach-style";
import { starDemoForStroke, starRowForStroke } from "@/lib/star-demos";
import {
  resolveIssueCorrectDemos,
  type IssueCorrectDemo,
} from "@/lib/issue-correct-demos";
import { cn } from "@/lib/utils";

type Props = {
  report: {
    id: string;
    title: string;
    strokeId?: string;
    coachId?: string;
    findings?: string[];
    scores?: Record<string, number>;
    videoUrl?: string;
    overlayUrl?: string;
    sourceUrl?: string;
    posterUrl?: string;
    coverUrl?: string;
    previewUrl?: string;
    actionFrameUrl?: string;
    detectRate?: number;
    videoName?: string;
  };
};

const ADD_PLATFORMS: DemoPlatform[] = ["youtube", "bilibili", "douyin", "xhs"];

export function VisualCoach({ report }: Props) {
  const extras = useDemoExtras();
  const session = useSessionRole();
  const { t, locale } = useI18n();
  const isCoach = session.role === "coach";
  const strokeId = strokeKeyFrom(report.strokeId, report.title);
  const starDemo = useMemo(() => starDemoForStroke(strokeId), [strokeId]);
  const starRow = useMemo(() => starRowForStroke(strokeId), [strokeId]);
  const refs = useMemo(
    () =>
      platformDemosFor(
        sortDemos([...builtInDemosFor(strokeId), ...extras.filter((item) => item.strokeId === strokeId)]),
      ),
    [extras, strokeId],
  );
  const [activeId, setActiveId] = useState(refs[0]?.id || "");
  const [title, setTitle] = useState("");
  const [clip, setClip] = useState("");
  const [platform, setPlatform] = useState<DemoPlatform>("youtube");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [issueDemos, setIssueDemos] = useState<IssueCorrectDemo[]>([]);
  const [issueSource, setIssueSource] = useState<"star" | "coach">("star");
  const [issueLoading, setIssueLoading] = useState(true);
  const [issueError, setIssueError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/tennis/api/demos");
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: StrokeDemoItem[] };
        if (Array.isArray(payload.items)) mergeServerDemos(payload.items);
      } catch {
        /* keep local extras */
      }
    })();
  }, []);

  useEffect(() => {
    if (!refs.some((item) => item.id === activeId)) setActiveId(refs[0]?.id || "");
  }, [refs, activeId]);

  useEffect(() => {
    let alive = true;
    setIssueLoading(true);
    setIssueError("");
    void (async () => {
      try {
        const result = await resolveIssueCorrectDemos({
          strokeId: report.strokeId,
          title: report.title,
          findings: report.findings || [],
          scores: report.scores || null,
          coachId: report.coachId,
          locale: locale === "en" ? "en" : "zh",
        });
        if (!alive) return;
        setIssueDemos(result.items);
        setIssueSource(result.source);
        if (result.loadingError) setIssueError(t("visual.demoError"));
      } catch {
        if (!alive) return;
        setIssueDemos([]);
        setIssueError(t("visual.demoError"));
      } finally {
        if (alive) setIssueLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    report.strokeId,
    report.title,
    report.findings,
    report.scores,
    report.coachId,
    locale,
    t,
  ]);

  const demo = refs.find((item) => item.id === activeId) || refs[0];
  const problems = problemMarks(report.strokeId, report.title, report.findings || []);
  const issueCount = issueDemos.filter((item) => item.issue.id !== "stroke").length;

  async function saveDemo() {
    if (!isCoach) return;
    setAdding(true);
    setAddError("");
    try {
      const next: StrokeDemoItem = {
        id: `extra-${Date.now()}`,
        strokeId,
        title: title.trim() || t("visual.coachDemo"),
        source: "coach-provided",
        platform,
        clip: clip.trim(),
        pageUrl: clip.trim(),
        plays: 0,
        likes: 0,
        coachPick: true,
        credit: t("visual.coachPick"),
      };
      if (!next.clip) {
        setAddError(t("visual.needClip"));
        return;
      }
      addDemoExtra(next);
      const response = await fetch("/tennis/api/demos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        setAddError(t("visual.needCoach"));
        return;
      }
      setTitle("");
      setClip("");
      setActiveId(next.id);
    } finally {
      setAdding(false);
    }
  }

  async function onUpload(file?: File | null) {
    if (!file || !isCoach) return;
    const id = `demo${Date.now()}`;
    try {
      const response = await fetch(`/tennis/api/clips/${id}`, { method: "PUT", body: file });
      if (response.ok) {
        setClip(`/tennis/api/clips/${id}`);
        if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
        return;
      }
    } catch {
      /* fall through */
    }
    setClip(URL.createObjectURL(file));
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <section className="space-y-4" data-section="visual-coach" data-role={session.role}>
      <figure className="overflow-hidden rounded-lg border border-border bg-card" data-visual="problem">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{t("visual.wrong")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("visual.wrongLead")}</p>
        </div>
        <ReportPlayer report={report} marks={problems} kind="problem" autoPlay={false} />
      </figure>

      <div
        className="space-y-3"
        data-visual="good"
        data-issue-demos="true"
        data-issue-count={String(issueCount)}
        data-demo-source={issueSource}
        data-star={starRow.starId}
        data-star-name={t(starRow.nameKey)}
      >
        <div className="px-1">
          <p className="text-xs font-semibold text-foreground">{t("visual.correct")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {issueCount > 0
              ? t("visual.correctByIssuesLead", { count: issueCount })
              : t("visual.correctLead", { name: t(starRow.nameKey) })}
          </p>
        </div>

        {issueLoading ? (
          <figure
            className="overflow-hidden rounded-lg border border-border bg-card px-3 py-8"
            data-issue-state="loading"
          >
            <p className="text-sm text-muted-foreground">{t("visual.demoLoading")}</p>
          </figure>
        ) : null}

        {!issueLoading && issueError ? (
          <figure
            className="overflow-hidden rounded-lg border border-border bg-card px-3 py-6"
            data-issue-state="error"
          >
            <p className="text-sm text-destructive">{issueError}</p>
            {starDemo ? (
              <div className="relative mt-3 min-h-[200px] bg-zinc-900">
                <DemoPlayer demo={starDemo} />
              </div>
            ) : null}
          </figure>
        ) : null}

        {!issueLoading && !issueError && issueDemos.length === 0 ? (
          <figure
            className="overflow-hidden rounded-lg border border-border bg-card px-3 py-6"
            data-issue-state="empty"
          >
            <p className="text-sm text-muted-foreground">{t("visual.noDemo")}</p>
          </figure>
        ) : null}

        {!issueLoading &&
          !issueError &&
          issueDemos.map((item) => {
            const issueLabel = locale === "en" ? item.issue.labelEn : item.issue.labelZh;
            const axisLabel =
              locale === "en"
                ? { balance: "Balance", contact: "Contact", chain: "Kinetic chain", effect: "Ball effect" }[
                    item.issue.axisKey
                  ]
                : item.issue.axis;
            return (
              <figure
                key={item.demo.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
                data-visual="good-issue"
                data-issue-id={item.issue.id}
                data-issue-axis={item.issue.axisKey}
                data-demo-source={item.source}
              >
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold text-primary" data-issue-axis-label="true">
                    {t("visual.correct")} · {axisLabel}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground" data-issue-label="true">
                    {issueLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground" data-star-label="true">
                    {locale === "en" ? item.creditEn : item.creditZh}
                  </p>
                </div>
                {item.status === "ready" ? (
                  <div className="relative min-h-[200px] bg-zinc-900">
                    <DemoPlayer demo={item.demo} />
                  </div>
                ) : (
                  <p className="px-3 py-6 text-sm text-muted-foreground">{t("visual.noDemo")}</p>
                )}
              </figure>
            );
          })}
      </div>

      <figure className="overflow-hidden rounded-lg border border-border bg-card" data-visual="refs">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{t("visual.refs")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("visual.refsLead")}</p>
          {demo ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {demo.title.startsWith("roster.") ? t(demo.title) : demo.title} · {platformName(locale, demo.platform)}
              {demo.likes
                ? ` · ${t("visual.playsLikes", { plays: formatCount(demo.plays), likes: formatCount(demo.likes) })}`
                : demo.plays
                  ? ` · ${t("visual.playsOnly", { plays: formatCount(demo.plays) })}`
                  : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 px-3 pb-2" data-demo-switch="true">
          {refs.map((item) => (
            <button
              key={item.id}
              type="button"
              data-demo-id={item.id}
              data-demo-source={item.source}
              data-demo-platform={item.platform}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                item.id === demo?.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {platformName(locale, item.platform)} · {item.title.startsWith("roster.") ? t(item.title) : item.title}
            </button>
          ))}
        </div>
        {demo ? (
          <div className="relative bg-zinc-900">
            <DemoPlayer demo={demo} />
          </div>
        ) : (
          <p className="px-3 py-6 text-sm text-muted-foreground">{t("visual.noDemo")}</p>
        )}
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          {demo?.credit}
          {demo?.pageUrl ? (
            <>
              {" · "}
              <a href={demo.pageUrl} target="_blank" rel="noreferrer" className="text-primary">
                {t("visual.openOn", { platform: platformName(locale, demo.platform) })}
              </a>
            </>
          ) : null}
        </p>
        {isCoach ? (
          <div className="space-y-2 border-t border-border px-3 py-3" data-demo-add="true">
            <p className="text-xs font-semibold text-foreground">{t("visual.addDemo")}</p>
            <p className="text-[11px] text-muted-foreground">{t("visual.addLead")}</p>
            <div className="flex flex-wrap gap-2">
              {ADD_PLATFORMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPlatform(item)}
                  className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", platform === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >
                  {platformName(locale, item)}
                </button>
              ))}
            </div>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("visual.titlePh")} />
            <Input value={clip} onChange={(event) => setClip(event.target.value)} placeholder={t("visual.clipPh")} />
            <Input type="file" accept="video/*" onChange={(event) => void onUpload(event.target.files?.[0])} />
            {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
            <Button type="button" size="sm" disabled={adding} onClick={() => void saveDemo()}>
              {adding ? t("visual.saving") : t("visual.saveDemo")}
            </Button>
          </div>
        ) : null}
      </figure>
    </section>
  );
}
