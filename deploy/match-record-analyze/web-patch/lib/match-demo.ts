/** Demo / local-first match analysis models for 涨球 match record MVP. */

export type MatchFormat = "singles" | "doubles";
export type StrokeKind = "forehand" | "backhand" | "serve" | "volley" | "overhead";
export type PointResult = "winner" | "forced_error" | "unforced_error" | "ace" | "double_fault";

export type MatchShot = {
  id: string;
  t: number; // seconds into match video
  end: number;
  stroke: StrokeKind;
  side: "you" | "opp";
  /** 1-based hit index within the point (第 N 拍). */
  shotIndex: number;
  speedKmh: number;
  depth: number; // 0–1 toward baseline
  accuracy: number; // 0–1 toward intended zone
  in: boolean;
  x: number; // bounce/contact court x 0–1
  y: number; // bounce/contact court y 0–1
  ballPath: { x: number; y: number }[];
};

export type MatchPoint = {
  id: string;
  index: number;
  start: number;
  end: number;
  scoreBefore: string;
  scoreAfter: string;
  setScore: string;
  result: PointResult;
  winner: "you" | "opp";
  rallyLength: number;
  server: "you" | "opp";
  shots: MatchShot[];
  lineCall?: { call: "in" | "out" | "close"; confidence: number; note: string };
  dead?: boolean;
};

export type MatchStats = {
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgDepth: number;
  avgAccuracy: number;
  avgRally: number;
  winners: number;
  unforced: number;
  aces: number;
  firstServePct: number;
  heatmap: number[][]; // 8x4 grid intensity
};

export type CoachingInsight = {
  id: string;
  kind: "serve" | "return" | "pattern" | "weak";
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  jumpPointId: string;
};

export type MatchRecord = {
  id: string;
  createdAt: string;
  title: string;
  format: MatchFormat;
  mode: "standard" | "ground";
  durationSec: number;
  players: { you: string; opp: string; youPartner?: string; oppPartner?: string };
  finalScore: string;
  points: MatchPoint[];
  stats: MatchStats;
  coaching: CoachingInsight[];
  videoLabel: string;
  pipeline: "demo" | "local" | "gpu";
  speedDisclaimer: string;
  watchNote: string;
};

const STROKES: StrokeKind[] = ["forehand", "backhand", "serve", "volley", "overhead"];
const RESULTS: PointResult[] = ["winner", "forced_error", "unforced_error", "ace", "double_fault"];

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Full-court depth: one baseline → other baseline (not mid-court stubs). */
function ballPath(side: "you" | "opp", endX: number, rand: () => number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const y0 = side === "you" ? 0.95 : 0.05;
  const y1 = side === "you" ? 0.05 : 0.95;
  const x0 = 0.32 + rand() * 0.36;
  const x1 = Math.min(0.9, Math.max(0.1, endX));
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push({
      x: x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * 0.035 * (rand() - 0.5),
      y: y0 + (y1 - y0) * u,
    });
  }
  return pts;
}

export function speedUnitLabel(zh: boolean, kmh: number): string {
  return zh ? `${kmh} 公里/时` : `${kmh} km/h`;
}

export function groundModeLabel(zh: boolean): string {
  return zh ? "地面机位" : "Ground mode";
}

function tennisScore(pointsYou: number, pointsOpp: number): string {
  const labels = ["0", "15", "30", "40"];
  if (pointsYou >= 3 && pointsOpp >= 3) {
    if (pointsYou === pointsOpp) return "40-40";
    if (pointsYou === pointsOpp + 1) return "Ad-40";
    if (pointsOpp === pointsYou + 1) return "40-Ad";
  }
  return `${labels[Math.min(pointsYou, 3)]}-${labels[Math.min(pointsOpp, 3)]}`;
}

export function buildDemoMatch(opts?: {
  format?: MatchFormat;
  mode?: "standard" | "ground";
  seed?: number;
  title?: string;
}): MatchRecord {
  const format = opts?.format || "singles";
  const mode = opts?.mode || "standard";
  const rand = mulberry32(opts?.seed ?? 20261101);
  const points: MatchPoint[] = [];
  let t = 2;
  let gamesYou = 0;
  let gamesOpp = 0;
  let ptsYou = 0;
  let ptsOpp = 0;
  let pointIndex = 0;

  const heat = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => 0));

  while (gamesYou < 6 || gamesOpp < 6) {
    if ((gamesYou >= 6 || gamesOpp >= 6) && Math.abs(gamesYou - gamesOpp) >= 2) break;
    if (gamesYou === 7 || gamesOpp === 7) break;
    // insert occasional dead-time blank
    if (rand() < 0.18) {
      const deadLen = 4 + Math.floor(rand() * 6);
      points.push({
        id: `dead-${pointIndex}`,
        index: pointIndex++,
        start: t,
        end: t + deadLen,
        scoreBefore: tennisScore(ptsYou, ptsOpp),
        scoreAfter: tennisScore(ptsYou, ptsOpp),
        setScore: `${gamesYou}-${gamesOpp}`,
        result: "forced_error",
        winner: "you",
        rallyLength: 0,
        server: gamesYou + gamesOpp === 0 ? "you" : (gamesYou + gamesOpp) % 2 === 0 ? "you" : "opp",
        shots: [],
        dead: true,
      });
      t += deadLen;
    }

    const server: "you" | "opp" = (gamesYou + gamesOpp) % 2 === 0 ? "you" : "opp";
    const rally = 1 + Math.floor(rand() * 10);
    const shots: MatchShot[] = [];
    const start = t;
    for (let s = 0; s < rally; s++) {
      const stroke: StrokeKind = s === 0 ? "serve" : STROKES[1 + Math.floor(rand() * 4)];
      const side: "you" | "opp" = (s % 2 === 0 ? server : server === "you" ? "opp" : "you");
      const x = 0.12 + rand() * 0.76;
      // Land deep near the far baseline so markers match full-depth traces.
      const y = side === "you" ? 0.06 + rand() * 0.1 : 0.84 + rand() * 0.1;
      const path = ballPath(side, x, rand);
      const end = path[path.length - 1] || { x, y };
      const gx = Math.min(7, Math.floor(end.x * 8));
      const gy = Math.min(3, Math.floor(end.y * 4));
      heat[gx][gy] += 1;
      const speed = stroke === "serve" ? 120 + rand() * 55 : 55 + rand() * 70;
      const dur = 0.7 + rand() * 0.9;
      shots.push({
        id: `s-${pointIndex}-${s}`,
        t,
        end: t + dur,
        stroke,
        side,
        shotIndex: s + 1,
        speedKmh: Math.round(speed),
        depth: Math.round((0.35 + rand() * 0.6) * 100) / 100,
        accuracy: Math.round((0.4 + rand() * 0.55) * 100) / 100,
        in: rand() > 0.12,
        x: end.x,
        y: end.y,
        ballPath: path,
      });
      t += dur;
    }
    const end = t + 0.4;
    const result = RESULTS[Math.floor(rand() * RESULTS.length)];
    let winner: "you" | "opp" =
      result === "ace" || result === "winner"
        ? server
        : result === "double_fault" || result === "unforced_error"
          ? server === "you"
            ? "opp"
            : "you"
          : rand() > 0.5
            ? "you"
            : "opp";
    if (result === "forced_error") winner = rand() > 0.45 ? "you" : "opp";

    const scoreBefore = tennisScore(ptsYou, ptsOpp);
    if (winner === "you") ptsYou += 1;
    else ptsOpp += 1;

    const gameOver =
      (ptsYou >= 4 || ptsOpp >= 4) && Math.abs(ptsYou - ptsOpp) >= 2;
    if (gameOver) {
      if (ptsYou > ptsOpp) gamesYou += 1;
      else gamesOpp += 1;
      ptsYou = 0;
      ptsOpp = 0;
    }
    const scoreAfter = gameOver ? "0-0" : tennisScore(ptsYou, ptsOpp);

    points.push({
      id: `p-${pointIndex}`,
      index: pointIndex++,
      start,
      end,
      scoreBefore,
      scoreAfter,
      setScore: `${gamesYou}-${gamesOpp}`,
      result,
      winner,
      rallyLength: rally,
      server,
      shots,
      lineCall:
        rand() > 0.55
          ? {
              call: rand() > 0.7 ? "out" : rand() > 0.5 ? "close" : "in",
              confidence: Math.round((0.62 + rand() * 0.35) * 100) / 100,
              note: "演示线审（尽力）",
            }
          : undefined,
    });
    t = end + 1.2 + rand() * 2;
    // Full set: never truncate mid-match for a short sample list.
    if (pointIndex > 400) break;
  }

  const liveShots = points.flatMap((p) => (p.dead ? [] : p.shots));
  const youShots = liveShots.filter((s) => s.side === "you");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const livePoints = points.filter((p) => !p.dead);
  const stats: MatchStats = {
    avgSpeedKmh: Math.round(avg(youShots.map((s) => s.speedKmh))),
    maxSpeedKmh: Math.round(Math.max(0, ...youShots.map((s) => s.speedKmh))),
    avgDepth: Math.round(avg(youShots.map((s) => s.depth)) * 100) / 100,
    avgAccuracy: Math.round(avg(youShots.map((s) => s.accuracy)) * 100) / 100,
    avgRally: Math.round(avg(livePoints.map((p) => p.rallyLength)) * 10) / 10,
    winners: livePoints.filter((p) => p.result === "winner" && p.winner === "you").length,
    unforced: livePoints.filter((p) => p.result === "unforced_error" && p.winner === "opp").length,
    aces: livePoints.filter((p) => p.result === "ace" && p.winner === "you").length,
    firstServePct: Math.round(55 + rand() * 30),
    heatmap: heat,
  };

  const firstWeak = livePoints.find((p) => p.result === "unforced_error" && p.winner === "opp") || livePoints[0];
  const firstServe = livePoints.find((p) => p.shots[0]?.stroke === "serve" && p.server === "you") || livePoints[0];
  const longRally = [...livePoints].sort((a, b) => b.rallyLength - a.rallyLength)[0] || livePoints[0];

  const coaching: CoachingInsight[] = [
    {
      id: "c-serve",
      kind: "serve",
      title: "发球落点偏中路",
      titleEn: "Serve landing too central",
      body: "一发多数落在发球区中线附近，外角压迫不足。下一场刻意把 3 个一发打宽外角。",
      bodyEn: "Most first serves land near the T. Widen 3 first serves next match for more pressure.",
      jumpPointId: firstServe.id,
    },
    {
      id: "c-return",
      kind: "return",
      title: "接发回球偏浅",
      titleEn: "Returns sit short",
      body: "接二发后第一拍落点偏浅，对手容易进攻。目标：回球过中场线半米以上。",
      bodyEn: "Return +1 lands short; opponent attacks freely. Aim to clear mid-court by half a meter.",
      jumpPointId: livePoints.find((p) => p.server === "opp")?.id || livePoints[0].id,
    },
    {
      id: "c-weak",
      kind: "weak",
      title: "反手非受迫失误偏多",
      titleEn: "Backhand unforced errors spike",
      body: "高压与快节奏对拉时反手下网。建议放慢引拍，优先打深直线过渡。",
      bodyEn: "Backhand dumps under pace. Slow the take-back and prefer deep down-the-line safety.",
      jumpPointId: firstWeak.id,
    },
    {
      id: "c-pattern",
      kind: "pattern",
      title: "最长回合可复制",
      titleEn: "Longest rally is copyable",
      body: "这场最长回合靠正手斜线打开空间。回看该分，记住你站位打开的时机。",
      bodyEn: "Your longest rally used FH cross to open space. Rewatch and note when you stepped in.",
      jumpPointId: longRally.id,
    },
  ];

  return {
    id: `m-${Date.now().toString(36)}-${Math.floor(rand() * 1e4).toString(36)}`,
    createdAt: new Date().toISOString(),
    title: opts?.title || (mode === "ground" ? "地面机位练习赛" : "周末练习赛"),
    format,
    mode,
    durationSec: Math.round(t),
    players:
      format === "doubles"
        ? { you: "你", opp: "对手 A", youPartner: "搭档", oppPartner: "对手 B" }
        : { you: "你", opp: "对手" },
    finalScore: `${gamesYou}-${gamesOpp}`,
    points,
    stats,
    coaching,
    videoLabel: mode === "ground" ? "竖屏 · 球心裁切演示" : "横屏比赛录像演示",
    pipeline: "demo",
    speedDisclaimer: "球速为估测值，误差约 ±10%。",
    watchNote: "",
  };
}

/** Trace colors: blue = you / 己方, red = opponent. */
export const TRACE_YOU = "#38bdf8";
export const TRACE_OPP = "#f87171";

export function playerSideLabel(
  zh: boolean,
  side: "you" | "opp",
  players?: MatchRecord["players"],
): string {
  const youName = (players?.you || "").trim();
  const oppName = (players?.opp || "").trim();
  if (side === "you") {
    if (youName && youName !== "你" && youName !== "我" && youName.toLowerCase() !== "you") {
      return zh ? `${youName}（你）` : `${youName} (you)`;
    }
    return zh ? "你（己方）" : "You";
  }
  if (oppName && oppName !== "对手" && oppName.toLowerCase() !== "opponent") {
    return zh ? `${oppName}（对手）` : `${oppName} (opp)`;
  }
  return zh ? "对手" : "Opponent";
}

export function shotRallyLabel(zh: boolean, shotIndex: number): string {
  return zh ? `第 ${shotIndex} 拍` : `Shot ${shotIndex}`;
}

export function trimDeadPoints(match: MatchRecord): MatchPoint[] {
  return match.points.filter((p) => !p.dead && p.rallyLength > 0);
}

export function filterPoints(
  match: MatchRecord,
  filters: { stroke?: StrokeKind | "all"; result?: PointResult | "all"; minRally?: number },
): MatchPoint[] {
  return trimDeadPoints(match).filter((p) => {
    if (filters.minRally && p.rallyLength < filters.minRally) return false;
    if (filters.result && filters.result !== "all" && p.result !== filters.result) return false;
    if (filters.stroke && filters.stroke !== "all") {
      if (!p.shots.some((s) => s.side === "you" && s.stroke === filters.stroke)) return false;
    }
    return true;
  });
}

export function scoreBarLabel(point: MatchPoint): string {
  return `${point.setScore} · ${point.scoreBefore}`;
}
