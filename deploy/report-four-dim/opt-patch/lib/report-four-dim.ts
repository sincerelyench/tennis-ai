/** Shared helpers for 涨球 report four-dimension + speed panels. */

export type AxisKey = "重心" | "击球点" | "动力链" | "击球效果";

export type AxisScore = {
  key: AxisKey;
  labelKey: string;
  value: number;
  max: number;
};

export type PublicSpeeds = {
  racket_kmh: number | null;
  wrist_kmh: number | null;
  hip_kmh: number | null;
  ball_in_kmh: number | null;
  ball_out_kmh: number | null;
  racket_kmh_max: number | null;
  swing_from: "racket" | "wrist" | null;
};

export const AXIS_DEFS: { key: AxisKey; max: number; labelKey: string }[] = [
  { key: "重心", max: 25, labelKey: "report.axis.weight" },
  { key: "击球点", max: 20, labelKey: "report.axis.contact" },
  { key: "动力链", max: 30, labelKey: "report.axis.chain" },
  { key: "击球效果", max: 25, labelKey: "report.axis.effect" },
];

export function parseAxisScores(scores: Record<string, unknown> | null | undefined): AxisScore[] {
  if (!scores || typeof scores !== "object") return [];
  const rows = AXIS_DEFS.map((def) => {
    const raw = Number(scores[def.key]);
    return {
      key: def.key,
      labelKey: def.labelKey,
      value: Number.isFinite(raw) ? Math.round(raw) : NaN,
      max: def.max,
    };
  }).filter((row) => Number.isFinite(row.value));
  return rows.length === AXIS_DEFS.length ? rows : [];
}

function asKmh(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number") return null;
  if (!Number.isFinite(value) || value < 0 || value > 250) return null;
  return value < 20 ? Math.round(value * 10) / 10 : Math.round(value);
}

/** Map TAI `overall.speeds` (or clip/swing) into public UI fields. */
export function parseSpeeds(raw: Record<string, unknown> | null | undefined): PublicSpeeds | null {
  if (!raw || typeof raw !== "object") return null;
  const swingFrom = raw.swing_from === "wrist" || raw.swing_from === "racket" ? raw.swing_from : null;
  const out: PublicSpeeds = {
    racket_kmh: asKmh(raw.swing_kmh ?? raw.racket_kmh),
    wrist_kmh: asKmh(raw.wrist_kmh),
    hip_kmh: asKmh(raw.hip_kmh),
    ball_in_kmh: asKmh(raw.ball_in_kmh),
    ball_out_kmh: asKmh(raw.ball_out_kmh),
    racket_kmh_max: asKmh(raw.swing_kmh_max ?? raw.racket_kmh_max),
    swing_from: swingFrom,
  };
  if (
    out.racket_kmh == null &&
    out.wrist_kmh == null &&
    out.hip_kmh == null &&
    out.ball_in_kmh == null &&
    out.ball_out_kmh == null
  ) {
    return null;
  }
  return out;
}

export function pickSpeedsFromReport(report: any): PublicSpeeds | null {
  const overall = report?.overall || report?.report?.overall || {};
  const direct = parseSpeeds(overall?.speeds);
  if (direct) return direct;
  const clips = report?.clips || report?.report?.clips || [];
  for (const clip of clips) {
    const fromSummary = parseSpeeds(clip?.summary?.speeds);
    if (fromSummary) return fromSummary;
    for (const swing of clip?.swings || []) {
      const fromSwing = parseSpeeds(swing?.speeds);
      if (fromSwing) return fromSwing;
    }
  }
  return null;
}

export function fmtKmh(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v >= 20 ? String(Math.round(v)) : v.toFixed(1);
}
