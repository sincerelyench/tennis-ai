"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type RatingCurvePoint = {
  id: string;
  date: string;
  rating: number;
  delta?: number;
  opponentName?: string;
  result?: "win" | "loss";
  kind?: "seed" | "match";
};

type Props = {
  points: RatingCurvePoint[];
  embedded?: boolean;
};

const W = 320;
const H = 148;
const PAD = { l: 28, r: 10, t: 14, b: 26 };

function formatRating(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function JourneyCurve({ points, embedded = false }: Props) {
  const { t } = useI18n();
  const series = useMemo(
    () => points.filter((point) => typeof point.rating === "number" && Number.isFinite(point.rating)),
    [points],
  );
  const [active, setActive] = useState(Math.max(0, series.length - 1));

  useEffect(() => {
    setActive(Math.max(0, series.length - 1));
  }, [series]);

  if (series.length < 2) {
    return (
      <div className={cn(embedded ? "py-1" : "rounded-lg border border-border bg-card p-4")} data-journey-curve="empty">
        <p className="text-sm font-semibold text-foreground">{t("curve.title")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("curve.empty")}</p>
      </div>
    );
  }

  const scores = series.map((p) => p.rating);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const pad = Math.max(0.2, (rawMax - rawMin) * 0.2 || 0.3);
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const xy = series.map((point, index) => {
    const x = PAD.l + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
    const y = PAD.t + ((max - point.rating) / (max - min || 1)) * innerH;
    return { ...point, x, y, index };
  });
  const line = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1].x.toFixed(1)} ${PAD.t + innerH} L${xy[0].x.toFixed(1)} ${PAD.t + innerH} Z`;
  const selected = xy[Math.min(active, xy.length - 1)] || xy[xy.length - 1];
  const mid = Math.round(((min + max) / 2) * 10) / 10;
  const ticks = [Math.round(max * 10) / 10, mid, Math.round(min * 10) / 10];

  return (
    <div className={cn(embedded ? "py-1" : "rounded-lg border border-border bg-card p-4")} data-journey-curve="true">
      <p className="text-sm font-semibold text-foreground">{t("curve.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("curve.hint")}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={t("curve.title")}>
        {ticks.map((tick) => {
          const y = PAD.t + ((max - tick) / (max - min || 1)) * innerH;
          return (
            <g key={`${tick}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
              <text x={PAD.l - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
                {formatRating(tick)}
              </text>
            </g>
          );
        })}
        <path d={area} className="fill-primary/15" />
        <path d={line} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((point) => (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.index === selected.index ? 6 : 4.5}
              className={point.index === selected.index ? "fill-primary" : "fill-background stroke-primary"}
              strokeWidth={point.index === selected.index ? 0 : 2}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="14"
              className="fill-transparent cursor-pointer"
              data-curve-point={point.id}
              onClick={() => setActive(point.index)}
            />
            <text x={point.x} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
              {point.date.slice(5) || point.date}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 rounded-md bg-muted px-3 py-2" data-curve-detail={selected.id}>
        <p className="text-xs font-semibold text-foreground">
          {selected.kind === "seed"
            ? t("journey.seedLabel")
            : selected.date}{" "}
          · {t("friends.utrLabel")} {formatRating(selected.rating)}
        </p>
        {selected.kind === "match" ? (
          <>
            <p className="mt-1 text-xs leading-5 text-foreground">
              {selected.result === "win" ? t("journey.resultWin") : t("journey.resultLoss")}
              {selected.opponentName ? ` · ${t("journey.vs")} ${selected.opponentName}` : ""}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {t("journey.change")}:{" "}
              {typeof selected.delta === "number"
                ? `${selected.delta > 0 ? "+" : ""}${formatRating(selected.delta)}`
                : "—"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("journey.seedHint")}</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {xy.map((point) => (
          <button
            key={point.id}
            type="button"
            data-curve-chip={point.id}
            onClick={() => setActive(point.index)}
            className={cn(
              "min-h-8 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              point.index === selected.index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {point.kind === "seed" ? t("journey.seedShort") : point.date.slice(5) || point.date}
          </button>
        ))}
      </div>
    </div>
  );
}
