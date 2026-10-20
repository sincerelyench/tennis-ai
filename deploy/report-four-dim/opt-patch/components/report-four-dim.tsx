"use client";

import {
  AXIS_DEFS,
  AxisScore,
  PublicSpeeds,
  fmtKmh,
  parseAxisScores,
  pickSpeedsFromReport,
} from "@/lib/report-four-dim";

const ZQ_FD_CSS = `
.zq-fd{--zq-fd-ink:#0f1f16;--zq-fd-muted:#5b6b62;--zq-fd-border:#d5e0d9;--zq-fd-card:#fff;--zq-fd-soft:#f4faf7;--zq-fd-primary:#0d9488;--zq-fd-bar:#0f766e;color:var(--zq-fd-ink);margin:0 0 1rem}
.zq-fd h2{margin:0 0 .65rem;font-size:1.05rem;font-weight:700}
.zq-fd-muted{color:var(--zq-fd-muted);font-size:.85rem;margin:0}
.zq-fd-dim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-bottom:1rem}
.zq-fd-speed-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}
.zq-fd-charts{display:grid;grid-template-columns:1fr;gap:.75rem}
@media (min-width:720px){.zq-fd-dim-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.zq-fd-speed-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.zq-fd-charts{grid-template-columns:1fr 1fr}}
.zq-fd-card{background:var(--zq-fd-card);border:1px solid var(--zq-fd-border);border-radius:14px;padding:.75rem .85rem .7rem;box-shadow:0 1px 0 rgba(15,31,22,.03)}
.zq-fd-lab{margin:0;font-size:.75rem;color:var(--zq-fd-muted)}
.zq-fd-val{margin:.35rem 0 .55rem;font-size:1.55rem;font-weight:750;letter-spacing:-.03em;line-height:1}
.zq-fd-max{font-size:.8rem;color:var(--zq-fd-muted);font-weight:500}
.zq-fd-bar{height:7px;border-radius:99px;background:var(--zq-fd-soft);overflow:hidden}
.zq-fd-bar>i{display:block;height:100%;background:linear-gradient(90deg,#14b8a6,var(--zq-fd-primary))}
.zq-fd-speed-val{margin:.4rem 0 0;font-size:1.35rem;font-weight:750}
.zq-fd-unit{font-size:.75rem;color:var(--zq-fd-muted);font-weight:500;margin-left:2px}
.zq-fd-note{margin:.65rem 0 1rem;font-size:.78rem;color:var(--zq-fd-muted);line-height:1.45}
.zq-fd-panel{background:var(--zq-fd-soft);border:1px solid var(--zq-fd-border);border-radius:14px;padding:.75rem}
.zq-fd-panel h3{margin:0 0 .5rem;font-size:.85rem;color:var(--zq-fd-muted);font-weight:600}
.zq-fd-radar{display:block;margin:0 auto;max-width:100%}
.zq-fd-hbar{display:grid;grid-template-columns:4.5em 1fr 2em;gap:.5rem;align-items:center;margin-bottom:.55rem}
.zq-fd-hbar-lab{font-size:.8rem;color:var(--zq-fd-muted)}
.zq-fd-hbar-track{height:12px;border-radius:99px;background:#e7eeea;overflow:hidden}
.zq-fd-hbar-track>i{display:block;height:100%;background:var(--zq-fd-bar)}
.zq-fd-hbar-num{text-align:right;font-weight:700;font-size:.85rem}
`;

type Labels = {
  fourTitle?: string;
  speedTitle?: string;
  speedEmpty?: string;
  speedNote?: string;
  speedNoteMax?: (max: string) => string;
  radarTitle?: string;
  barsTitle?: string;
  dash?: string;
  racket?: string;
  racketWrist?: string;
  wrist?: string;
  hip?: string;
  ballIn?: string;
  ballOut?: string;
  axis: (key: string) => string;
};

const ZH: Labels = {
  fourTitle: "四维评分",
  speedTitle: "速度估计",
  speedEmpty: "这次没有可用的画面速度估计。",
  speedNote: "按身高或拍长把画面位移换成公里每小时，不是测速雷达。侧面更准，正面会偏慢。",
  speedNoteMax: (max) =>
    `按身高或拍长把画面位移换成公里每小时，不是测速雷达。侧面更准，正面会偏慢。最快一拍拍头约 ${max} km/h。`,
  radarTitle: "四维雷达",
  barsTitle: "分项条形",
  dash: "—",
  racket: "拍头",
  racketWrist: "拍头·腕推算",
  wrist: "手腕",
  hip: "转髋",
  ballIn: "来球",
  ballOut: "出球",
  axis: (key) =>
    ({ 重心: "重心", 击球点: "击球点", 动力链: "动力链", 击球效果: "击球效果" } as Record<string, string>)[
      key
    ] || key,
};

type Props = {
  /** Chinese-key scores map, or pre-parsed AxisScore[] */
  scores?: Record<string, unknown> | AxisScore[] | null;
  speeds?: PublicSpeeds | Record<string, unknown> | null;
  /** Full TAI report — used when scores/speeds omitted */
  report?: any;
  labels?: Partial<Labels>;
  className?: string;
};

function normalizeAxes(scores: Props["scores"], report: any): AxisScore[] {
  if (Array.isArray(scores) && scores.length) return scores as AxisScore[];
  const fromProp = parseAxisScores(scores as Record<string, unknown>);
  if (fromProp.length) return fromProp;
  const overall = report?.overall || report?.report?.overall;
  return parseAxisScores(overall?.scores);
}

function normalizeSpeeds(speeds: Props["speeds"], report: any): PublicSpeeds | null {
  if (speeds && typeof speeds === "object" && "racket_kmh" in (speeds as object)) {
    return speeds as PublicSpeeds;
  }
  if (speeds && typeof speeds === "object") {
    const parsed = pickSpeedsFromReport({ overall: { speeds } });
    if (parsed) return parsed;
  }
  return pickSpeedsFromReport(report);
}

function Radar({ axes, labels }: { axes: AxisScore[]; labels: Labels }) {
  const cx = 100;
  const cy = 100;
  const r = 72;
  const n = axes.length || 4;
  const grid = [0.4, 0.7, 1].map((k) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `${cx + Math.cos(ang) * r * k},${cy + Math.sin(ang) * r * k}`;
    }).join(" ");
    return <polygon key={k} points={pts} fill="none" stroke="#d5e0d9" />;
  });
  const data = axes
    .map((axis, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const v = Math.max(0, Math.min(1, axis.value / axis.max));
      return `${cx + Math.cos(ang) * r * v},${cy + Math.sin(ang) * r * v}`;
    })
    .join(" ");
  const labs = axes.map((axis, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + Math.cos(ang) * 94;
    const y = cy + Math.sin(ang) * 94;
    return (
      <text
        key={axis.key}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fill="#5b6b62"
      >
        {labels.axis(axis.key)}
      </text>
    );
  });
  return (
    <svg viewBox="0 0 200 200" width="220" height="220" aria-hidden className="zq-fd-radar">
      {grid}
      <polygon points={data} fill="rgba(13,148,136,.22)" stroke="#0d9488" strokeWidth="1.8" />
      {labs}
    </svg>
  );
}

export function ReportFourDim({ scores, speeds, report, labels: labelOverrides, className }: Props) {
  const labels = { ...ZH, ...labelOverrides, axis: labelOverrides?.axis || ZH.axis };
  const axes = normalizeAxes(scores, report);
  const speed = normalizeSpeeds(speeds, report);

  if (!axes.length && !speed) {
    return (
      <section className={`zq-fd ${className || ""}`.trim()} data-zq-four-dim="empty">
        <p className="zq-fd-muted">{labels.speedEmpty}</p>
      </section>
    );
  }

  const racketLab = speed?.swing_from === "wrist" ? labels.racketWrist : labels.racket;
  const speedCells = speed
    ? [
        [racketLab!, speed.racket_kmh],
        [labels.wrist!, speed.wrist_kmh],
        [labels.hip!, speed.hip_kmh],
        [labels.ballIn!, speed.ball_in_kmh],
        [labels.ballOut!, speed.ball_out_kmh],
      ] as const
    : [];
  const maxNote = speed ? fmtKmh(speed.racket_kmh_max) : "";

  return (
    <section className={`zq-fd ${className || ""}`.trim()} data-zq-four-dim="1">
      <style dangerouslySetInnerHTML={{ __html: ZQ_FD_CSS }} />

      {!!axes.length && (
        <>
          <h2>{labels.fourTitle}</h2>
          <div className="zq-fd-dim-grid">
            {axes.map((axis) => {
              const pct = Math.max(0, Math.min(100, Math.round((axis.value / axis.max) * 100)));
              return (
                <article key={axis.key} className="zq-fd-card">
                  <p className="zq-fd-lab">{labels.axis(axis.key)}</p>
                  <p className="zq-fd-val">
                    {axis.value}
                    <span className="zq-fd-max"> / {axis.max}</span>
                  </p>
                  <div className="zq-fd-bar" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <h2>{labels.speedTitle}</h2>
      {!speed ? (
        <p className="zq-fd-muted zq-fd-note">{labels.speedEmpty}</p>
      ) : (
        <>
          <div className="zq-fd-speed-grid">
            {speedCells.map(([lab, val]) => {
              const n = fmtKmh(val);
              return (
                <article key={lab} className="zq-fd-card">
                  <p className="zq-fd-lab">{lab}</p>
                  <p className="zq-fd-speed-val">
                    {n || labels.dash}
                    {n ? <span className="zq-fd-unit">km/h</span> : null}
                  </p>
                </article>
              );
            })}
          </div>
          <p className="zq-fd-note">
            {maxNote && labels.speedNoteMax ? labels.speedNoteMax(maxNote) : labels.speedNote}
          </p>
        </>
      )}

      {!!axes.length && (
        <div className="zq-fd-charts">
          <div className="zq-fd-panel">
            <h3>{labels.radarTitle}</h3>
            <Radar axes={axes.length ? axes : AXIS_DEFS.map((d) => ({ ...d, value: 0, labelKey: d.labelKey }))} labels={labels} />
          </div>
          <div className="zq-fd-panel">
            <h3>{labels.barsTitle}</h3>
            {axes.map((axis) => {
              const pct = Math.max(0, Math.min(100, Math.round((axis.value / axis.max) * 100)));
              return (
                <div className="zq-fd-hbar" key={axis.key}>
                  <span className="zq-fd-hbar-lab">{labels.axis(axis.key)}</span>
                  <div className="zq-fd-hbar-track" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="zq-fd-hbar-num">{axis.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default ReportFourDim;
