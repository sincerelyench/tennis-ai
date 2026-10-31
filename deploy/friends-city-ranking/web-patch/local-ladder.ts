/**
 * Local UTR-like friends ladder (涨球), scoped by city.
 *
 * Not official UTR. Seed: selfLevel × 2.15 → one decimal on a UTR-like ~1–16 scale.
 * Match update (chronological): Elo-style expected win, recency over ~six weeks,
 * K = 0.42 singles / 0.28 doubles. Doubles uses pair average.
 */

export type LadderFormat = "singles" | "doubles";

export type LadderPlayer = {
  id: string;
  name: string;
  /** Self-level used only to seed the UTR-like rating (× 2.15). */
  ntrp: number;
  /** City catalog id (see cities.ts). */
  cityId: string;
  placeKey: string;
  strokes: string[];
};

export type LadderMatch = {
  id: string;
  date: string; // YYYY-MM-DD
  format: LadderFormat;
  winners: string[];
  losers: string[];
  sets?: [number, number][];
};

export type LadderRow = LadderPlayer & {
  rank: number;
  rating: number;
  seed: number;
  wins: number;
  losses: number;
  played: boolean;
  lastOpponentId?: string;
  lastOpponentName?: string;
  lastResult?: "win" | "loss";
};

/** UTR-like seed from self-level. */
export function utrSeedFromSelfLevel(selfLevel: number): number {
  return round1(selfLevel * 2.15);
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function sideMean(ids: string[], ratings: Record<string, number>): number {
  const vals = ids.map((id) => ratings[id]).filter((v) => Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Map set scores → winner actual in [0.58, 0.92] (bagel moves more than 7–6). */
function actualFromSets(sets?: [number, number][]): number {
  if (!sets?.length) return 1;
  let tw = 0;
  let tl = 0;
  for (const [w, l] of sets) {
    tw += w;
    tl += l;
  }
  const share = tw / Math.max(1, tw + tl);
  return Math.min(0.92, Math.max(0.58, 0.58 + (share - 0.5) * 0.72));
}

function recencyWeight(date: string, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - Date.parse(`${date}T12:00:00`)) / 864e5,
  );
  return Math.exp(-ageDays / 42);
}

export const ladderPlayers: LadderPlayer[] = [
  // 无锡
  { id: "f1", name: "陈晓", ntrp: 3.5, cityId: "wuxi", placeKey: "place.wuxiSports", strokes: ["fh-topspin", "serve"] },
  { id: "f2", name: "李佳", ntrp: 2.5, cityId: "wuxi", placeKey: "place.binhu", strokes: ["fh-topspin", "bh-slice"] },
  { id: "f3", name: "周宁", ntrp: 4, cityId: "wuxi", placeKey: "place.taihu", strokes: ["serve", "smash"] },
  { id: "f4", name: "王硕", ntrp: 3, cityId: "wuxi", placeKey: "place.liangxi", strokes: ["bh-topspin", "fh-slice"] },
  { id: "f5", name: "赵琳", ntrp: 4.5, cityId: "wuxi", placeKey: "place.taihu", strokes: ["fh-topspin", "serve"] },
  { id: "f6", name: "孙凯", ntrp: 3.5, cityId: "wuxi", placeKey: "place.xinqu", strokes: ["bh-topspin", "serve"] },
  { id: "f7", name: "钱芳", ntrp: 3, cityId: "wuxi", placeKey: "place.wuxiSports", strokes: ["fh-slice", "bh-slice"] },
  { id: "f8", name: "吴迪", ntrp: 2.5, cityId: "wuxi", placeKey: "place.huishan", strokes: ["fh-topspin"] },
  // 上海
  { id: "s1", name: "陆明", ntrp: 4.0, cityId: "shanghai", placeKey: "place.taihu", strokes: ["serve", "fh-topspin"] },
  { id: "s2", name: "唐悦", ntrp: 3.5, cityId: "shanghai", placeKey: "place.liangxi", strokes: ["bh-topspin", "serve"] },
  { id: "s3", name: "何川", ntrp: 3.0, cityId: "shanghai", placeKey: "place.binhu", strokes: ["fh-slice", "bh-slice"] },
  { id: "s4", name: "沈琪", ntrp: 4.5, cityId: "shanghai", placeKey: "place.wuxiSports", strokes: ["serve", "smash"] },
  // 北京
  { id: "b1", name: "韩磊", ntrp: 4.0, cityId: "beijing", placeKey: "place.taihu", strokes: ["fh-topspin", "serve"] },
  { id: "b2", name: "马婷", ntrp: 3.0, cityId: "beijing", placeKey: "place.binhu", strokes: ["bh-topspin", "fh-slice"] },
  { id: "b3", name: "刘洋", ntrp: 3.5, cityId: "beijing", placeKey: "place.liangxi", strokes: ["serve", "bh-slice"] },
  // 广州 / 深圳
  { id: "g1", name: "梁浩", ntrp: 3.5, cityId: "guangzhou", placeKey: "place.xinqu", strokes: ["fh-topspin", "serve"] },
  { id: "g2", name: "陈雨", ntrp: 2.5, cityId: "guangzhou", placeKey: "place.huishan", strokes: ["bh-slice"] },
  { id: "z1", name: "黄凯", ntrp: 4.0, cityId: "shenzhen", placeKey: "place.taihu", strokes: ["serve", "smash"] },
  { id: "z2", name: "林萱", ntrp: 3.0, cityId: "shenzhen", placeKey: "place.binhu", strokes: ["fh-topspin", "bh-topspin"] },
  // 杭州 / 南京 / 苏州
  { id: "h1", name: "徐峰", ntrp: 3.5, cityId: "hangzhou", placeKey: "place.wuxiSports", strokes: ["fh-topspin", "serve"] },
  { id: "n1", name: "蒋宁", ntrp: 3.0, cityId: "nanjing", placeKey: "place.liangxi", strokes: ["bh-topspin", "serve"] },
  { id: "u1", name: "顾然", ntrp: 4.0, cityId: "suzhou", placeKey: "place.taihu", strokes: ["serve", "fh-topspin"] },
  // 英文全球示例
  { id: "ny1", name: "Alex Kim", ntrp: 4.0, cityId: "newyork", placeKey: "place.taihu", strokes: ["serve", "fh-topspin"] },
  { id: "ny2", name: "Sam Rivera", ntrp: 3.0, cityId: "newyork", placeKey: "place.binhu", strokes: ["bh-slice", "fh-slice"] },
  { id: "ld1", name: "Jamie Cole", ntrp: 3.5, cityId: "london", placeKey: "place.liangxi", strokes: ["fh-topspin", "serve"] },
  { id: "tk1", name: "Yuki Sato", ntrp: 4.5, cityId: "tokyo", placeKey: "place.wuxiSports", strokes: ["serve", "smash"] },
  { id: "sg1", name: "Mei Tan", ntrp: 3.5, cityId: "singapore", placeKey: "place.xinqu", strokes: ["bh-topspin", "serve"] },
];

export const ladderMatches: LadderMatch[] = [
  // Wuxi (original set)
  { id: "m01", date: "2026-09-15", format: "singles", winners: ["f4"], losers: ["f7"], sets: [[6, 4], [6, 3]] },
  { id: "m02", date: "2026-09-20", format: "doubles", winners: ["f5", "f6"], losers: ["f3", "f4"], sets: [[6, 2], [6, 3]] },
  { id: "m03", date: "2026-09-27", format: "doubles", winners: ["f5", "f3"], losers: ["f1", "f6"], sets: [[6, 4], [6, 4]] },
  { id: "m04", date: "2026-09-28", format: "singles", winners: ["f5"], losers: ["f3"], sets: [[6, 3], [6, 4]] },
  { id: "m05", date: "2026-09-30", format: "singles", winners: ["f3"], losers: ["f1"], sets: [[6, 4], [7, 5]] },
  { id: "m06", date: "2026-10-01", format: "singles", winners: ["f1"], losers: ["f4"], sets: [[6, 2], [6, 3]] },
  { id: "m07", date: "2026-10-01", format: "doubles", winners: ["f1", "f4"], losers: ["f2", "f7"], sets: [[6, 2], [6, 3]] },
  { id: "m08", date: "2026-10-02", format: "singles", winners: ["f6"], losers: ["f1"], sets: [[7, 6], [4, 6], [1, 0]] },
  { id: "m09", date: "2026-10-03", format: "singles", winners: ["f5"], losers: ["f6"], sets: [[6, 1], [6, 2]] },
  { id: "m10", date: "2026-10-03", format: "doubles", winners: ["f6", "f7"], losers: ["f1", "f2"], sets: [[7, 5], [6, 3]] },
  { id: "m11", date: "2026-10-04", format: "singles", winners: ["f4"], losers: ["f2"], sets: [[6, 3], [6, 4]] },
  { id: "m12", date: "2026-10-04", format: "doubles", winners: ["f5", "f1"], losers: ["f3", "f6"], sets: [[6, 7], [6, 4], [1, 0]] },
  { id: "m13", date: "2026-10-05", format: "singles", winners: ["f3"], losers: ["f6"], sets: [[6, 4], [6, 4]] },
  { id: "m14", date: "2026-10-05", format: "singles", winners: ["f1"], losers: ["f7"], sets: [[6, 2], [6, 1]] },
  { id: "m15", date: "2026-10-06", format: "singles", winners: ["f7"], losers: ["f2"], sets: [[6, 4], [3, 6], [1, 0]] },
  { id: "m16", date: "2026-10-06", format: "singles", winners: ["f5"], losers: ["f3"], sets: [[7, 5], [6, 3]] },
  { id: "m17", date: "2026-10-06", format: "doubles", winners: ["f3", "f4"], losers: ["f6", "f7"], sets: [[6, 3], [6, 4]] },
  // Shanghai
  { id: "ms1", date: "2026-10-02", format: "singles", winners: ["s4"], losers: ["s1"], sets: [[6, 3], [6, 4]] },
  { id: "ms2", date: "2026-10-04", format: "singles", winners: ["s1"], losers: ["s2"], sets: [[6, 2], [7, 5]] },
  { id: "ms3", date: "2026-10-05", format: "singles", winners: ["s2"], losers: ["s3"], sets: [[6, 4], [6, 3]] },
  { id: "ms4", date: "2026-10-06", format: "doubles", winners: ["s4", "s1"], losers: ["s2", "s3"], sets: [[6, 3], [6, 2]] },
  // Beijing
  { id: "mb1", date: "2026-10-03", format: "singles", winners: ["b1"], losers: ["b3"], sets: [[6, 4], [6, 4]] },
  { id: "mb2", date: "2026-10-05", format: "singles", winners: ["b3"], losers: ["b2"], sets: [[6, 3], [4, 6], [1, 0]] },
  // Guangzhou / Shenzhen
  { id: "mg1", date: "2026-10-04", format: "singles", winners: ["g1"], losers: ["g2"], sets: [[6, 1], [6, 2]] },
  { id: "mz1", date: "2026-10-05", format: "singles", winners: ["z1"], losers: ["z2"], sets: [[6, 3], [6, 4]] },
  // World
  { id: "mny1", date: "2026-10-04", format: "singles", winners: ["ny1"], losers: ["ny2"], sets: [[6, 2], [6, 3]] },
  { id: "mld1", date: "2026-10-05", format: "singles", winners: ["ld1"], losers: ["ny2"], sets: [[6, 4], [7, 5]] },
];

/**
 * Rate the ladder for one format, optionally filtered to one city.
 * Matches only count when every participant is in the filtered player set
 * (same-city matches). Returns rows sorted by UTR-like rating desc.
 */
export function rateLadder(
  format: LadderFormat,
  now: Date = new Date("2026-10-07T12:00:00"),
  players: LadderPlayer[] = ladderPlayers,
  matches: LadderMatch[] = ladderMatches,
  cityId?: string | null,
): LadderRow[] {
  const scoped = cityId ? players.filter((p) => p.cityId === cityId) : players.slice();
  const allowed = new Set(scoped.map((p) => p.id));

  const ratings: Record<string, number> = {};
  for (const p of scoped) {
    ratings[p.id] = utrSeedFromSelfLevel(p.ntrp);
  }

  const K = format === "singles" ? 0.42 : 0.28;
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const last: Record<string, { opponentId: string; result: "win" | "loss" }> = {};

  const ordered = matches
    .filter((m) => m.format === format)
    .filter((m) => [...m.winners, ...m.losers].every((id) => allowed.has(id)))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const m of ordered) {
    const self = sideMean(m.winners, ratings);
    const opp = sideMean(m.losers, ratings);
    const actual = actualFromSets(m.sets);
    const expected = 1 / (1 + 10 ** ((opp - self) / 2.4));
    const step = recencyWeight(m.date, now) * K;

    for (const id of m.winners) {
      ratings[id] = (ratings[id] || 0) + step * (actual - expected);
      wins[id] = (wins[id] || 0) + 1;
      last[id] = { opponentId: m.losers[0], result: "win" };
    }
    for (const id of m.losers) {
      ratings[id] = (ratings[id] || 0) + step * (1 - actual - (1 - expected));
      losses[id] = (losses[id] || 0) + 1;
      last[id] = { opponentId: m.winners[0], result: "loss" };
    }
  }

  const names = Object.fromEntries(scoped.map((p) => [p.id, p.name]));
  const rows: LadderRow[] = scoped.map((p) => {
    const played = (wins[p.id] || 0) + (losses[p.id] || 0);
    const L = last[p.id];
    return {
      ...p,
      rank: 0,
      rating: round1(ratings[p.id]),
      seed: utrSeedFromSelfLevel(p.ntrp),
      wins: wins[p.id] || 0,
      losses: losses[p.id] || 0,
      played: played > 0,
      lastOpponentId: L?.opponentId,
      lastOpponentName: L ? names[L.opponentId] : undefined,
      lastResult: L?.result,
    };
  });

  rows.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}
