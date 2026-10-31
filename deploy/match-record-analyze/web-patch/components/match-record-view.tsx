"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { pageClass } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import {
  createMatchFromOptions,
  ensureDemoMatch,
  useMatchRecords,
} from "@/lib/match-store";
import type { MatchFormat } from "@/lib/match-demo";
import { cameraSetupCopy } from "@/lib/camera-setup";

export function MatchRecordView() {
  const { locale } = useI18n();
  const zh = locale !== "en";
  const cam = cameraSetupCopy(zh);
  const router = useRouter();
  const records = useMatchRecords();
  const [format, setFormat] = useState<MatchFormat>("singles");
  const [mode, setMode] = useState<"standard" | "ground">("standard");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmLive, setConfirmLive] = useState(false);

  function start(kind: "live" | "demo" | "upload") {
    if (kind === "live" && !confirmLive) {
      setConfirmLive(true);
      setNote(
        zh
          ? "请先确认上方机位要点，再点「机位 OK，开始录制」。"
          : "Confirm the framing tips above, then tap “Framing OK — start”.",
      );
      return;
    }
    setConfirmLive(false);
    setBusy(true);
    setNote(
      zh
        ? kind === "demo"
          ? "正在生成演示比赛分析…"
          : kind === "upload"
            ? "本机剪空镜 + 演示流水线（GPU 球轨未完成时用本地演示数据）…"
            : "录制中：保持机位稳定。真机相机可用；本环境用演示分析。"
        : kind === "demo"
          ? "Building demo match analysis…"
          : kind === "upload"
            ? "Local blank-trim + demo pipeline (GPU ball track incomplete)…"
            : "Recording: keep framing stable. Demo analysis used when camera/GPU unavailable.",
    );
    window.setTimeout(() => {
      const match =
        kind === "demo"
          ? ensureDemoMatch()
          : createMatchFromOptions({
              format,
              mode,
              title:
                kind === "upload"
                  ? zh
                    ? mode === "ground"
                      ? "Ground Mode 上传赛"
                      : "上传比赛录像"
                    : mode === "ground"
                      ? "Ground Mode upload"
                      : "Uploaded match"
                  : zh
                    ? mode === "ground"
                      ? "Ground Mode 录制"
                      : "现场录制比赛"
                    : mode === "ground"
                      ? "Ground Mode record"
                      : "Live match record",
            });
      setBusy(false);
      router.push(`/analysis/match/${match.id}`);
    }, 450);
  }

  const tipList = mode === "ground" ? cam.groundItems : cam.items;

  return (
    <div className={pageClass} data-page="match-record" data-zq-match-mvp="1">
      <div>
        <h1 className="text-base font-bold text-foreground">
          {zh ? "比赛录制 · 分析" : "Match record · analyze"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {zh
            ? "涨球比赛录制：录制整场、剪空镜、计分条、球速/落点热力、赛后教练点评。挥拍技术分析入口仍保留。"
            : "Zhangqiu match analyze: record the match, trim dead time, score bar, speed/heatmap, post-match coaching. Stroke analyze stays available."}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/analysis" className="text-xs text-primary">
            {zh ? "返回分析" : "Back to Analyze"}
          </Link>
          <Link href="/analysis/new" className="text-xs text-primary" data-action="stroke-analyze">
            {zh ? "挥拍技术分析" : "Stroke analyze"}
          </Link>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-3" data-section="camera-setup">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{cam.title}</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{cam.subtitle}</p>
        </div>
        <h3 className="text-xs font-semibold text-foreground">
          {mode === "ground" ? cam.groundTitle : cam.standardTitle}
        </h3>
        <ul className="space-y-2">
          {tipList.map((tip) => (
            <li
              key={tip.key}
              data-tip={tip.key}
              className="rounded-md border border-border/70 bg-background/40 px-2.5 py-2 text-[11px] leading-5 text-muted-foreground"
            >
              <span className="font-semibold text-foreground">{tip.label}</span>
              <span className="mt-0.5 block">{tip.text}</span>
            </li>
          ))}
        </ul>
        <p
          className="rounded-md border border-primary/30 bg-primary-subtle/40 px-2.5 py-2 text-[11px] leading-5 text-foreground"
          data-during-tip="true"
        >
          <span className="font-semibold">{cam.duringTitle}</span>
          <span className="mt-0.5 block text-muted-foreground">{cam.during}</span>
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-3" data-section="match-setup">
        <h2 className="text-sm font-semibold text-foreground">{zh ? "开局设置" : "Setup"}</h2>
        <div className="flex flex-wrap gap-2" data-field="format">
          {(["singles", "doubles"] as MatchFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              data-format={f}
              onClick={() => setFormat(f)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium",
                format === f ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
              )}
            >
              {f === "singles" ? (zh ? "单打" : "Singles") : zh ? "双打" : "Doubles"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" data-field="mode">
          <button
            type="button"
            data-mode="standard"
            onClick={() => {
              setMode("standard");
              setConfirmLive(false);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              mode === "standard" ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
            )}
          >
            {zh ? "标准机位" : "Standard"}
          </button>
          <button
            type="button"
            data-mode="ground"
            onClick={() => {
              setMode("ground");
              setConfirmLive(false);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              mode === "ground" ? "border-primary bg-primary-subtle text-primary" : "border-border text-foreground",
            )}
          >
            {zh ? "Ground Mode（手机放地上）" : "Ground Mode (phone on ground)"}
          </button>
        </div>
        {mode === "ground" ? (
          <p className="text-[11px] leading-5 text-muted-foreground" data-ground-hint="true">
            {zh
              ? "Ground Mode：自动剪空白、按回合/击球筛选，竖屏导出以球为中心（社媒向）。真机 GPU 球心跟踪未完成时用演示裁切。"
              : "Ground Mode: auto-cut blanks, filter by rally/shot, vertical ball-centered export. Demo crop when GPU tracking is incomplete."}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            data-action={confirmLive ? "record-match-confirm" : "record-match"}
            disabled={busy}
            onClick={() => start("live")}
          >
            {confirmLive ? cam.ready : zh ? "开始录制比赛" : "Start recording"}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-action="upload-match"
            disabled={busy}
            onClick={() => start("upload")}
          >
            {zh ? "上传比赛录像" : "Upload match video"}
          </Button>
          <Button type="button" variant="outline" data-action="demo-match" disabled={busy} onClick={() => start("demo")}>
            {zh ? "打开演示赛" : "Open demo match"}
          </Button>
        </div>
        {busy ? (
          <p className="text-[11px] leading-5 text-primary" data-recording-banner="true">
            {cam.duringTitle}：{cam.during}
          </p>
        ) : null}
        {note ? (
          <p className="text-[11px] text-muted-foreground" data-match-note="true">
            {note}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground" data-speed-disclaimer="true">
          {zh ? "球速为估测值，误差约 ±10%。" : "Shot speed is estimated (±10%)."}
        </p>
      </section>

      <section className="space-y-2" data-section="match-history">
        <h2 className="text-sm font-semibold text-foreground">{zh ? "本机比赛" : "Saved matches"}</h2>
        {records.length === 0 ? (
          <p className="text-xs text-muted-foreground">{zh ? "还没有比赛。先录一段或打开演示赛。" : "No matches yet. Record or open the demo."}</p>
        ) : (
          <ul className="space-y-2">
            {records.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/analysis/match/${m.id}`}
                  data-match-id={m.id}
                  className="block rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                    <span className="shrink-0 text-xs text-primary">{m.finalScore}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.format === "doubles" ? (zh ? "双打" : "Doubles") : zh ? "单打" : "Singles"}
                    {" · "}
                    {m.mode === "ground" ? "Ground" : zh ? "标准" : "Standard"}
                    {" · "}
                    {m.pipeline === "demo" ? (zh ? "演示数据" : "demo data") : m.pipeline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        {zh ? "品牌：涨球 / 涨球教练" : "Brand: 涨球 / Zhangqiu Coach"}
      </p>
      <Link href="/analysis/new" className={cn(buttonVariants({ variant: "outline" }), "h-9 text-xs")}>
        {zh ? "去挥拍技术分析（不回归）" : "Stroke analyze (unchanged)"}
      </Link>
    </div>
  );
}
