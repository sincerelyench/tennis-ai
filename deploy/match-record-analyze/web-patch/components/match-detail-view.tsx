"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { pageClass } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import {
  TRACE_OPP,
  TRACE_YOU,
  filterPoints,
  playerSideLabel,
  scoreBarLabel,
  shotRallyLabel,
  speedUnitLabel,
  type PointResult,
  type StrokeKind,
} from "@/lib/match-demo";
import { getMatchById, ensureDemoMatch, saveMatch } from "@/lib/match-store";

const STROKE_OPTS: Array<StrokeKind | "all"> = ["all", "forehand", "backhand", "serve", "volley", "overhead"];
const RESULT_OPTS: Array<PointResult | "all"> = [
  "all",
  "winner",
  "forced_error",
  "unforced_error",
  "ace",
  "double_fault",
];

function labelStroke(zh: boolean, s: StrokeKind | "all") {
  if (s === "all") return zh ? "全部技术" : "All strokes";
  const map: Record<StrokeKind, [string, string]> = {
    forehand: ["正手", "Forehand"],
    backhand: ["反手", "Backhand"],
    serve: ["发球", "Serve"],
    volley: ["截击", "Volley"],
    overhead: ["高压", "Overhead"],
  };
  return zh ? map[s][0] : map[s][1];
}

function labelResult(zh: boolean, r: PointResult | "all") {
  if (r === "all") return zh ? "全部结果" : "All results";
  const map: Record<PointResult, [string, string]> = {
    winner: ["制胜分", "Winner"],
    forced_error: ["压迫失误", "Forced error"],
    unforced_error: ["非受迫", "Unforced"],
    ace: ["发球直接得分", "Ace"],
    double_fault: ["双误", "Double fault"],
  };
  return zh ? map[r][0] : map[r][1];
}

export function MatchDetailView({ matchId }: { matchId: string }) {
  const { locale } = useI18n();
  const zh = locale !== "en";
  const [tick, setTick] = useState(0);
  const match = useMemo(() => {
    void tick;
    return getMatchById(matchId) || (matchId.startsWith("demo") ? ensureDemoMatch() : null);
  }, [matchId, tick]);

  const [stroke, setStroke] = useState<StrokeKind | "all">("all");
  const [result, setResult] = useState<PointResult | "all">("all");
  const [minRally, setMinRally] = useState(0);
  const [ballTrace, setBallTrace] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [activePointId, setActivePointId] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const points = useMemo(
    () => (match ? filterPoints(match, { stroke, result, minRally: minRally || undefined }) : []),
    [match, stroke, result, minRally],
  );
  const active = points.find((p) => p.id === activePointId) || points[0] || null;

  useEffect(() => {
    if (!match) return;
    if (!activePointId && points[0]) setActivePointId(points[0].id);
  }, [match, points, activePointId]);

  useEffect(() => {
    if (!active) return;
    setPlayhead(active.start);
  }, [active?.id]);

  useEffect(() => {
    if (!active || !voiceOn || typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const call = active.lineCall?.call;
    const score = scoreBarLabel(active);
    const text = zh
      ? `${score}。${call === "out" ? "出界" : call === "close" ? "压线，请看回放" : "界内"}。${
          active.winner === "you" ? "你得分" : "对方得分"
        }`
      : `${score}. ${call === "out" ? "Out" : call === "close" ? "Close — review" : "In"}. ${
          active.winner === "you" ? "Your point" : "Opponent point"
        }`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = zh ? "zh-CN" : "en-US";
    synth.cancel();
    synth.speak(u);
    return () => synth.cancel();
  }, [active?.id, voiceOn, zh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !match) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // court — solid green only; keep lines; no heatmap / color patches
    // Inset vertically so baselines sit between score bar and legend (full depth visible).
    const x0 = w * 0.08, x1 = w * 0.92, xm = w * 0.5;
    const y0 = h * 0.14, y1 = h * 0.82, ym = (y0 + y1) / 2;
    const mapX = (px: number) => x0 + px * (x1 - x0);
    const mapY = (py: number) => y0 + py * (y1 - y0);
    ctx.fillStyle = "#1f4a38";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(244,239,228,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.beginPath();
    ctx.moveTo(xm, y0);
    ctx.lineTo(xm, y1);
    ctx.moveTo(x0, ym);
    ctx.lineTo(x1, ym);
    // service boxes
    const ySvcNear = mapY(0.25);
    const ySvcFar = mapY(0.75);
    ctx.moveTo(x0, ySvcNear);
    ctx.lineTo(x1, ySvcNear);
    ctx.moveTo(x0, ySvcFar);
    ctx.lineTo(x1, ySvcFar);
    ctx.moveTo(xm, ySvcNear);
    ctx.lineTo(xm, ySvcFar);
    ctx.stroke();

    if (ballTrace && active) {
      active.shots.forEach((shot, i) => {
        const color = shot.side === "you" ? TRACE_YOU : TRACE_OPP;
        const shotN = shot.shotIndex || i + 1;
        ctx.beginPath();
        shot.ballPath.forEach((p, pi) => {
          const px = mapX(p.x);
          const py = mapY(p.y);
          if (pi === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        const last = shot.ballPath[shot.ballPath.length - 1] || { x: shot.x, y: shot.y };
        const lx = mapX(last.x);
        const ly = mapY(last.y);
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(7,20,14,0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Landing = which hit in the rally + per-shot speed (locale-only copy)
        const rallyTxt = shotRallyLabel(zh, shotN);
        const speedTxt = speedUnitLabel(zh, shot.speedKmh);
        ctx.font = "600 11px ui-sans-serif, system-ui";
        const tw = Math.max(ctx.measureText(rallyTxt).width, ctx.measureText(speedTxt).width);
        const pad = 4;
        const boxW = tw + pad * 2;
        const boxH = 28;
        let bx = Math.min(Math.max(4, lx + 8), w - boxW - 4);
        let by = Math.min(Math.max(32, ly - boxH - 6), h - boxH - 4);
        ctx.fillStyle = "rgba(7,20,14,0.78)";
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.fillStyle = color;
        ctx.fillText(rallyTxt, bx + pad, by + 12);
        ctx.fillStyle = "#f4efe4";
        ctx.fillText(speedTxt, bx + pad, by + 24);
      });
    }

    // score bar overlay
    if (active) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = "#f4efe4";
      ctx.font = "600 13px ui-sans-serif, system-ui";
      ctx.fillText(`${scoreBarLabel(active)}  →  ${active.scoreAfter}`, 10, 18);
    }

    // Explicit color legend: blue = you, red = opponent
    const youLabel = playerSideLabel(zh, "you", match.players);
    const oppLabel = playerSideLabel(zh, "opp", match.players);
    ctx.fillStyle = "rgba(7,20,14,0.72)";
    ctx.fillRect(8, h - 34, w - 16, 26);
    ctx.font = "600 11px ui-sans-serif, system-ui";
    ctx.fillStyle = TRACE_YOU;
    ctx.fillText(zh ? `蓝 = ${youLabel}` : `Blue = ${youLabel}`, 16, h - 16);
    ctx.fillStyle = TRACE_OPP;
    const left = zh ? `红 = ${oppLabel}` : `Red = ${oppLabel}`;
    ctx.fillText(left, Math.min(w * 0.48, w - ctx.measureText(left).width - 16), h - 16);
  }, [match, active, ballTrace, playhead, zh]);

  async function createShare() {
    if (!match) return;
    setShareBusy(true);
    try {
      const res = await fetch("/tennis/api/match/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match, ownerLabel: zh ? "涨球球员" : "Zhangqiu player", coachReviewOpen: true }),
      });
      const data = (await res.json()) as { url?: string; path?: string };
      if (!res.ok || !data.url) throw new Error("share_failed");
      setShareUrl(data.url.startsWith("http") ? data.url : `https://yqchen.blog${data.url}`);
    } catch {
      // offline / local fallback: encode minimal id in query for coach review hook note
      setShareUrl(`https://yqchen.blog/tennis/share/m/local-${match.id}`);
    } finally {
      setShareBusy(false);
    }
  }

  function exportGroundVertical() {
    if (!match) return;
    const next = {
      ...match,
      mode: "ground" as const,
      videoLabel: zh ? "竖屏 · 球心裁切导出（演示）" : "Vertical ball-centered export (demo)",
    };
    saveMatch(next);
    setTick((n) => n + 1);
  }

  if (!match) {
    return (
      <div className={pageClass} data-page="match-missing">
        <p className="text-sm text-foreground">{zh ? "找不到这场比赛。" : "Match not found."}</p>
        <Link href="/analysis/match" className="mt-3 text-xs text-primary">
          {zh ? "返回比赛录制" : "Back to match record"}
        </Link>
      </div>
    );
  }

  return (
    <div className={pageClass} data-page="match-detail" data-match-id={match.id} data-zq-match-mvp="1">
      <div>
        <h1 className="text-base font-bold text-foreground">{match.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {match.format === "doubles" ? (zh ? "双打" : "Doubles") : zh ? "单打" : "Singles"} · {match.finalScore} ·{" "}
          {match.videoLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/analysis/match" className="text-xs text-primary">
            {zh ? "比赛列表" : "Matches"}
          </Link>
          <Link href="/analysis" className="text-xs text-primary">
            {zh ? "分析 tab" : "Analyze tab"}
          </Link>
          <Link href="/analysis/new" className="text-xs text-primary">
            {zh ? "挥拍分析" : "Stroke analyze"}
          </Link>
        </div>
      </div>

      <section className="space-y-2" data-section="replay">
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border border-border bg-card",
            match.mode === "ground" ? "mx-auto max-w-[280px]" : "w-full",
          )}
          data-ground-export={match.mode === "ground" ? "true" : undefined}
        >
          <canvas
            ref={canvasRef}
            width={match.mode === "ground" ? 320 : 640}
            height={match.mode === "ground" ? 560 : 360}
            className="block h-auto w-full"
            data-ball-trace={ballTrace ? "on" : "off"}
          />
          <div className="absolute bottom-10 left-2 right-2 flex flex-wrap gap-2">
            <span className="rounded bg-black/55 px-2 py-1 text-[10px] text-white" data-speed-disclaimer="true">
              {match.speedDisclaimer}
            </span>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-3 text-[11px]"
          data-trace-legend="you-opp"
          data-legend-blue="you"
          data-legend-red="opp"
        >
          <span className="inline-flex items-center gap-1.5" style={{ color: TRACE_YOU }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TRACE_YOU }} />
            {zh
              ? `蓝 = ${playerSideLabel(true, "you", match.players)}`
              : `Blue = ${playerSideLabel(false, "you", match.players)}`}
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: TRACE_OPP }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TRACE_OPP }} />
            {zh
              ? `红 = ${playerSideLabel(true, "opp", match.players)}`
              : `Red = ${playerSideLabel(false, "opp", match.players)}`}
          </span>
        </div>
        {active ? (
          <ul
            className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border bg-card p-2"
            data-section="per-shot-speeds"
          >
            {active.shots.map((shot, i) => {
              const n = shot.shotIndex || i + 1;
              const color = shot.side === "you" ? TRACE_YOU : TRACE_OPP;
              return (
                <li
                  key={shot.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
                  data-shot-index={n}
                  data-shot-side={shot.side}
                  data-shot-speed={shot.speedKmh}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                    <span className="font-medium text-foreground">{shotRallyLabel(zh, n)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {playerSideLabel(zh, shot.side, match.players)} · {labelStroke(zh, shot.stroke)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
                    {speedUnitLabel(zh, shot.speedKmh)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-toggle="ball-trace"
            onClick={() => setBallTrace((v) => !v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs",
              ballTrace ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
            )}
          >
            {zh ? `球轨迹 ${ballTrace ? "开" : "关"}` : `Ball trace ${ballTrace ? "on" : "off"}`}
          </button>
          <button
            type="button"
            data-toggle="voice-callouts"
            onClick={() => setVoiceOn((v) => !v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs",
              voiceOn ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
            )}
          >
            {zh ? `语音喊判 ${voiceOn ? "开" : "关"}` : `Voice callouts ${voiceOn ? "on" : "off"}`}
          </button>
          <button
            type="button"
            data-action="ground-export"
            onClick={exportGroundVertical}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
          >
            {zh ? "地面机位竖屏导出" : "Ground vertical export"}
          </button>
        </div>
        {active?.lineCall ? (
          <p className="text-[11px] text-muted-foreground" data-line-call="true">
            {zh ? "线审（尽力）" : "Line call (best-effort)"}
            {": "}
            {zh
              ? active.lineCall.call === "out"
                ? "出界"
                : active.lineCall.call === "close"
                  ? "压线待审"
                  : "界内"
              : active.lineCall.call}
            {" · "}
            {Math.round(active.lineCall.confidence * 100)}% · {active.lineCall.note}
          </p>
        ) : null}
      </section>

      <section className="space-y-2" data-section="filters">
        <h2 className="text-sm font-semibold text-foreground">
          {zh ? `全部回合 ${points.length} 分（已剪空镜）` : `All rallies · ${points.length} points (dead time trimmed)`}
        </h2>
        <div className="flex flex-wrap gap-2">
          {STROKE_OPTS.map((s) => (
            <button
              key={s}
              type="button"
              data-filter-stroke={s}
              onClick={() => setStroke(s)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px]",
                stroke === s ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
              )}
            >
              {labelStroke(zh, s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {RESULT_OPTS.map((r) => (
            <button
              key={r}
              type="button"
              data-filter-result={r}
              onClick={() => setResult(r)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px]",
                result === r ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
              )}
            >
              {labelResult(zh, r)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {zh ? "最短回合" : "Min rally"}
          <input
            type="range"
            min={0}
            max={8}
            value={minRally}
            data-filter-rally="true"
            onChange={(e) => setMinRally(Number(e.target.value))}
          />
          <span>{minRally || 0}</span>
        </label>
        <ul
          className="max-h-[min(60vh,520px)] space-y-1 overflow-auto rounded-lg border border-border bg-card p-2"
          data-section="all-rallies"
        >
          {points.map((p, pi) => (
            <li key={p.id}>
              <button
                type="button"
                data-point-id={p.id}
                onClick={() => {
                  setActivePointId(p.id);
                  setPlayhead(p.start);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs",
                  active?.id === p.id ? "bg-primary-subtle text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <span>
                  #{pi + 1} · {scoreBarLabel(p)} · {labelResult(zh, p.result)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.rallyLength}
                  {zh ? "拍" : " shots"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" data-section="stats">
        <h2 className="text-sm font-semibold text-foreground">{zh ? "击球数据" : "Shot stats"}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [zh ? "均速" : "Avg speed", speedUnitLabel(zh, match.stats.avgSpeedKmh)],
            [zh ? "最快" : "Max speed", speedUnitLabel(zh, match.stats.maxSpeedKmh)],
            [zh ? "深度" : "Depth", `${Math.round(match.stats.avgDepth * 100)}%`],
            [zh ? "精准" : "Accuracy", `${Math.round(match.stats.avgAccuracy * 100)}%`],
            [zh ? "回合均长" : "Avg rally", String(match.stats.avgRally)],
            [zh ? "制胜分" : "Winners", String(match.stats.winners)],
            [zh ? "非受迫" : "UFEs", String(match.stats.unforced)],
            [zh ? "一发%" : "1st serve", `${match.stats.firstServePct}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{k}</p>
              <p className="text-sm font-semibold text-foreground">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground" data-speed-disclaimer="true">
          {zh
            ? "球速估测，约 ±10%。蓝红轨迹为底线到对面底线全场深度。"
            : "Speed estimate ±10%. Blue/red traces span baseline to baseline."}
        </p>
      </section>

      <section className="space-y-2" data-section="coaching">
        <h2 className="text-sm font-semibold text-foreground">{zh ? "涨球教练 · 赛后点评" : "Zhangqiu Coach · post-match"}</h2>
        <ul className="space-y-2">
          {match.coaching.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card px-3 py-2.5" data-coaching={c.kind}>
              <p className="text-sm font-medium text-foreground">{zh ? c.title : c.titleEn}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{zh ? c.body : c.bodyEn}</p>
              <button
                type="button"
                className="mt-2 text-xs text-primary"
                data-jump-point={c.jumpPointId}
                onClick={() => setActivePointId(c.jumpPointId)}
              >
                {zh ? "跳到该分" : "Jump to point"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" data-section="share">
        <h2 className="text-sm font-semibold text-foreground">{zh ? "分享 / 教练复盘" : "Share / coach review"}</h2>
        <p className="text-xs text-muted-foreground">
          {zh
            ? "生成访客链接（无需会员）。开启教练复盘钩子后，涨球教练可在消息/学员侧打开点评。"
            : "Create a viewer link (no membership). Coach review hook lets Zhangqiu Coach open notes."}
        </p>
        <Button type="button" data-action="share-match" disabled={shareBusy} onClick={() => void createShare()}>
          {shareBusy ? (zh ? "生成中…" : "Creating…") : zh ? "生成分享链接" : "Create share link"}
        </Button>
        {shareUrl ? (
          <p className="break-all text-xs text-primary" data-share-url="true">
            {shareUrl}
          </p>
        ) : null}
        <Link href="/inbox" className={cn(buttonVariants({ variant: "outline" }), "h-9 text-xs")}>
          {zh ? "打开教练消息钩子" : "Open coach inbox hook"}
        </Link>
      </section>
    </div>
  );
}
