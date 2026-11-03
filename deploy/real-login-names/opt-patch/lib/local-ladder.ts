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

export const ladderPlayers: LadderPlayer[] = [];

export const ladderMatches: LadderMatch[] = [];

/**
 * Rate the ladder for one format, optionally filtered to one city.
 * Matches only count when every participant is in the filtered player set
 * (same-city matches). Returns rows sorted by UTR-like rating desc.
 */

/** Build ladder players from auth directory entries (real display names only). */
export function playersFromDirectory(
  users: { id: string; displayName?: string; name?: string; cityId?: string; level?: number; ntrp?: number }[],
): LadderPlayer[] {
  const out: LadderPlayer[] = [];
  for (const u of users) {
    const name = String(u.displayName || u.name || "").trim();
    if (!name) continue;
    const level = Number(u.level ?? u.ntrp ?? 3.5);
    out.push({
      id: String(u.id),
      name,
      ntrp: Number.isFinite(level) ? level : 3.5,
      cityId: String(u.cityId || "").trim() || "unknown",
      placeKey: "",
      strokes: [],
    });
  }
  return out;
}

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
