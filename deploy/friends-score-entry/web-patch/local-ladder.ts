/**
 * Local UTR-like friends ladder (涨球).
 *
 * Not official UTR. Explainable stand-in for Wuxi / nearby friends ranking.
 * Same model on web (`lib/local-ladder.ts`) and uni-app (`apps/uniapp/src/local-ladder.ts`).
 *
 * Seed: selfLevel × 2.15 → one decimal on a UTR-like ~1–16 scale
 *   (club 2.5–4.5 band maps roughly to 5–10).
 *
 * Match update (chronological):
 * 1. Side rating = mean of that side’s current ratings (pair avg in doubles).
 * 2. Expected win = 1 / (1 + 10^((opp − self) / 2.4)).
 * 3. Actual = 1 if no sets; else game-share mapped into [0.58, 0.92] for winner.
 * 4. Recency = exp(−ageDays / 42) — last ~six weeks weigh more.
 * 5. K = 0.42 singles, 0.28 doubles.
 * 6. rating += K × recency × (actual − expected).
 *
 * Display: sort by live rating; labels say UTR (not NTRP). Internal `ntrp`
 * on roster rows is only the self-level seed input.
 */

export type LadderFormat = "singles" | "doubles";

export type LadderPlayer = {
  id: string;
  name: string;
  /** Self-level used only to seed the UTR-like rating (× 2.15). */
  ntrp: number;
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
  { id: "f1", name: "陈晓", ntrp: 3.5, placeKey: "place.wuxiSports", strokes: ["fh-topspin", "serve"] },
  { id: "f2", name: "李佳", ntrp: 2.5, placeKey: "place.binhu", strokes: ["fh-topspin", "bh-slice"] },
  { id: "f3", name: "周宁", ntrp: 4, placeKey: "place.taihu", strokes: ["serve", "smash"] },
  { id: "f4", name: "王硕", ntrp: 3, placeKey: "place.liangxi", strokes: ["bh-topspin", "fh-slice"] },
  { id: "f5", name: "赵琳", ntrp: 4.5, placeKey: "place.taihu", strokes: ["fh-topspin", "serve"] },
  { id: "f6", name: "孙凯", ntrp: 3.5, placeKey: "place.xinqu", strokes: ["bh-topspin", "serve"] },
  { id: "f7", name: "钱芳", ntrp: 3, placeKey: "place.wuxiSports", strokes: ["fh-slice", "bh-slice"] },
  { id: "f8", name: "吴迪", ntrp: 2.5, placeKey: "place.huishan", strokes: ["fh-topspin"] },
];

export const ladderMatches: LadderMatch[] = [
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
];

/**
 * Rate the local ladder for one format. Returns rows sorted by UTR-like rating desc.
 */
export function rateLadder(
  format: LadderFormat,
  now: Date = new Date("2026-10-07T12:00:00"),
  players: LadderPlayer[] = ladderPlayers,
  matches: LadderMatch[] = ladderMatches,
): LadderRow[] {
  const ratings: Record<string, number> = {};
  for (const p of players) {
    ratings[p.id] = utrSeedFromSelfLevel(p.ntrp);
  }

  const K = format === "singles" ? 0.42 : 0.28;
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const last: Record<string, { opponentId: string; result: "win" | "loss" }> = {};

  const ordered = matches
    .filter((m) => m.format === format)
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

  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const rows: LadderRow[] = players.map((p) => {
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
