/**
 * Local UTR-style friends ladder (涨球), scoped by city.
 *
 * Documented approximation of the public UTR algorithm — NOT official UTR /
 * Universal Tennis. Product copy:「UTR 风格 / 等级分」.
 *
 * Core (see docs/utr-official-algorithm.md):
 * 1. Expected game-win % from pre-match rating Δ (logistic).
 * 2. Actual game-win % from set scores (games count, not sets won).
 * 3. Match rating = opponent side rating + edge(actual games %).
 *    Deltas are zero-sum: (MR_A − R_A) + (MR_B − R_B) = 0.
 * 4. Published rating ≈ weighted average of last ≤30 match ratings
 *    inside a rolling 12-month window.
 * 5. Weights: format length, closeness, opponent reliability, recency.
 * 6. Ignore matches when |Δ| > 2.0 and the favorite wins as expected.
 * 7. (P) projected until ~5 qualifying matches.
 * 8. Singles / doubles are separate ladders; doubles uses side averages.
 * 9. Scale clamped to ~1.00–16.50.
 *
 * Seed (before enough results): selfLevel × 2.15.
 */

export type LadderFormat = "singles" | "doubles";

export type LadderPlayer = {
  id: string;
  name: string;
  /** Self-level used only to seed the UTR-style rating (× 2.15). */
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
  /** Qualifying matches counted in the rating window. */
  qualifiedMatches: number;
  /** True while qualifying matches < PROJECTED_THRESHOLD (~5). */
  projected: boolean;
  lastOpponentId?: string;
  lastOpponentName?: string;
  lastResult?: "win" | "loss";
  /**
   * Rank change vs previous city snapshot (after prior confirmed match).
   * Positive = moved up (rank number decreased). Null = no prior snapshot.
   */
  rankDelta?: number | null;
  /** Rating change vs previous snapshot. Null = no prior snapshot. */
  ratingDelta?: number | null;
};

type MatchRatingSample = {
  matchId: string;
  date: string;
  matchRating: number;
  weight: number;
  opponentIds: string[];
};

const RATING_MIN = 1.0;
const RATING_MAX = 16.5;
/** Logistic scale: ~1.0 rating gap → ~65% expected games. */
const GAME_DIFF_SCALE = 1.6;
const WINDOW_MATCHES = 30;
const WINDOW_DAYS = 365;
const PROJECTED_THRESHOLD = 5;
const EXCLUDE_GAP = 2.0;
/** Half-life-ish recency (~120 days). */
const RECENCY_TAU_DAYS = 120;

/** UTR-style seed from self-level. */
export function utrSeedFromSelfLevel(selfLevel: number): number {
  return clampRating(round2(selfLevel * 2.15));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Display / API still prefer one decimal for compact UI. */
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function clampRating(x: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, x));
}

function sideMean(ids: string[], ratings: Record<string, number>): number {
  const vals = ids.map((id) => ratings[id]).filter((v) => Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function ageDays(date: string, now: Date): number {
  return Math.max(0, (now.getTime() - Date.parse(`${date}T12:00:00`)) / 864e5);
}

/** Clamp game win % away from 0/1 so logit is finite. */
function clampPct(p: number): number {
  return Math.min(0.98, Math.max(0.02, p));
}

/** Expected share of games won given rating differential. */
export function expectedGamePct(selfRating: number, oppRating: number): number {
  return 1 / (1 + 10 ** ((oppRating - selfRating) / GAME_DIFF_SCALE));
}

/** Invert logistic: rating edge that would expect this game-win %. */
export function ratingEdgeFromGamePct(pct: number): number {
  const p = clampPct(pct);
  return GAME_DIFF_SCALE * Math.log10(p / (1 - p));
}

/**
 * Winner's raw game share from set scores (games totals, not sets).
 * No sets → treat as a decisive win (~0.85 games) so MR still moves.
 */
export function winnerGameShare(sets?: [number, number][]): {
  share: number;
  totalGames: number;
} {
  if (!sets?.length) return { share: 0.85, totalGames: 0 };
  let tw = 0;
  let tl = 0;
  for (const [w, l] of sets) {
    tw += w;
    tl += l;
  }
  const total = tw + tl;
  if (total <= 0) return { share: 0.85, totalGames: 0 };
  return { share: tw / total, totalGames: total };
}

function formatWeight(sets?: [number, number][]): number {
  if (!sets?.length) return 0.75;
  if (sets.length >= 3) return 1.15;
  const total = sets.reduce((s, [a, b]) => s + a + b, 0);
  // Short / pro-set-ish (e.g. 8-4) weighs less than a normal best-of-3 pair.
  if (sets.length === 1 || total <= 12) return 0.8;
  return 1.0;
}

function closenessWeight(diff: number): number {
  return Math.exp(-Math.abs(diff) / 1.2);
}

function reliabilityWeight(oppQualified: number): number {
  if (oppQualified <= 0) return 0.55;
  if (oppQualified < PROJECTED_THRESHOLD) {
    return 0.55 + (0.3 * oppQualified) / PROJECTED_THRESHOLD;
  }
  return Math.min(1.2, 0.9 + 0.03 * Math.min(oppQualified, 10));
}

function recencyWeight(date: string, now: Date): number {
  return Math.exp(-ageDays(date, now) / RECENCY_TAU_DAYS);
}

/**
 * |Δ| > 2.0 and the higher-rated side won → too one-sided, ignore.
 * Upsets (underdog wins) always count.
 */
export function shouldExcludeBlowout(
  winnerSideRating: number,
  loserSideRating: number,
): boolean {
  const gap = Math.abs(winnerSideRating - loserSideRating);
  if (gap <= EXCLUDE_GAP) return false;
  return winnerSideRating > loserSideRating;
}

function weightedAverage(samples: MatchRatingSample[], now: Date): number | null {
  const cutoff = now.getTime() - WINDOW_DAYS * 864e5;
  const recent = samples
    .filter((s) => Date.parse(`${s.date}T12:00:00`) >= cutoff)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.matchId.localeCompare(a.matchId))
    .slice(0, WINDOW_MATCHES);
  if (!recent.length) return null;
  let num = 0;
  let den = 0;
  for (const s of recent) {
    // Re-apply recency relative to `now` so the published rating ages.
    const w = s.weight * recencyWeight(s.date, now);
    if (w <= 0) continue;
    num += w * s.matchRating;
    den += w;
  }
  if (den <= 0) return null;
  return clampRating(num / den);
}

function qualifyingCount(samples: MatchRatingSample[], now: Date): number {
  const cutoff = now.getTime() - WINDOW_DAYS * 864e5;
  return samples
    .filter((s) => Date.parse(`${s.date}T12:00:00`) >= cutoff)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.matchId.localeCompare(a.matchId))
    .slice(0, WINDOW_MATCHES).length;
}

export const ladderPlayers: LadderPlayer[] = [];

export const ladderMatches: LadderMatch[] = [];

/** Build ladder players from auth directory entries (real display names only). */
export function playersFromDirectory(
  users: {
    id: string;
    displayName?: string;
    name?: string;
    cityId?: string;
    level?: number;
    ntrp?: number;
  }[],
): LadderPlayer[] {
  const out: LadderPlayer[] = [];
  for (const u of users) {
    const name = String(u.displayName || u.name || "").trim();
    if (!name) continue;
    const level = Number(u.level ?? u.ntrp ?? 3);
    out.push({
      id: String(u.id),
      name,
      ntrp: Number.isFinite(level) ? level : 3,
      cityId: String(u.cityId || "").trim() || "unknown",
      placeKey: "",
      strokes: [],
    });
  }
  return out;
}

/**
 * Ensure the logged-in user appears on the local ladder for the city they are viewing.
 * No displayName → unchanged (callers keep empty = 0).
 * Replaces any prior self row so a stale/mismatched cityId cannot hide them.
 */
/** Prefer real phone ids over u_* placeholders when display names collide. */
export function dedupePlayersByName(players: LadderPlayer[]): LadderPlayer[] {
  const byName = new Map<string, LadderPlayer>();
  const score = (p: LadderPlayer) => {
    const id = String(p.id || "");
    let s = 0;
    if (/^\d{6,}$/.test(id)) s += 4;
    if (!id.startsWith("u_")) s += 2;
    if (Number.isFinite(p.ntrp) && p.ntrp > 0) s += 1;
    return s;
  };
  for (const p of players) {
    const key = String(p.name || "").trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || score(p) > score(prev)) byName.set(key, p);
  }
  return Array.from(byName.values());
}

export function ensureSelfInPlayers(
  players: LadderPlayer[],
  self: {
    id?: string | null;
    phone?: string | null;
    name?: string | null;
    displayName?: string | null;
    level?: number | null;
    ntrp?: number | null;
    cityId?: string | null;
  } | null | undefined,
): LadderPlayer[] {
  const name = String(self?.displayName || self?.name || "").trim();
  const cityId = String(self?.cityId || "").trim();
  if (!name || !cityId) return players.slice();

  const id = String(self?.id || self?.phone || "").trim() || `self:${name}`;
  const levelRaw = Number(self?.level ?? self?.ntrp ?? 3);
  const ntrp = Number.isFinite(levelRaw) ? levelRaw : 3;
  const rest = players.filter((p) => p.id !== id && p.name !== name);
  return [
    ...rest,
    {
      id,
      name,
      ntrp,
      cityId,
      placeKey: "",
      strokes: [],
    },
  ];
}

type ReplayHooks = {
  /** Called after each match that involves this playerId (included or excluded). */
  onPlayerMatch?: (info: {
    match: LadderMatch;
    before: number;
    after: number;
    excluded: boolean;
    matchRating?: number;
  }) => void;
  focusPlayerId?: string;
};

/**
 * Chronological UTR-style replay. Mutates nothing outside returned maps.
 * Ratings start at seed; after each counted match, each side's published
 * rating becomes the weighted average of their recent match ratings.
 */
function replayFormat(
  format: LadderFormat,
  now: Date,
  players: LadderPlayer[],
  matches: LadderMatch[],
  hooks?: ReplayHooks,
): {
  ratings: Record<string, number>;
  histories: Record<string, MatchRatingSample[]>;
  wins: Record<string, number>;
  losses: Record<string, number>;
  last: Record<string, { opponentId: string; result: "win" | "loss" }>;
} {
  const ratings: Record<string, number> = {};
  const histories: Record<string, MatchRatingSample[]> = {};
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const last: Record<string, { opponentId: string; result: "win" | "loss" }> = {};

  for (const p of players) {
    ratings[p.id] = utrSeedFromSelfLevel(p.ntrp);
    histories[p.id] = [];
  }

  const allowed = new Set(players.map((p) => p.id));
  const ordered = matches
    .filter((m) => m.format === format)
    .filter((m) => [...m.winners, ...m.losers].every((id) => allowed.has(id)))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const m of ordered) {
    const winSide = sideMean(m.winners, ratings);
    const loseSide = sideMean(m.losers, ratings);
    const excluded = shouldExcludeBlowout(winSide, loseSide);
    const { share: winShare } = winnerGameShare(m.sets);

    const focus = hooks?.focusPlayerId;
    const involved =
      !!focus && (m.winners.includes(focus) || m.losers.includes(focus));
    const beforeFocus = focus ? ratings[focus] : 0;

    if (!excluded) {
      const mrWin = clampRating(loseSide + ratingEdgeFromGamePct(winShare));
      const mrLose = clampRating(winSide + ratingEdgeFromGamePct(1 - winShare));
      // Zero-sum check in rating space: deltas cancel when MRs unbound.
      const diff = Math.abs(winSide - loseSide);
      const asOfMatch = new Date(`${m.date}T12:00:00`);
      const baseW =
        formatWeight(m.sets) *
        closenessWeight(diff) *
        recencyWeight(m.date, asOfMatch);

      const winOppQualified = Math.min(
        ...m.losers.map((id) => qualifyingCount(histories[id] || [], asOfMatch)),
      );
      const loseOppQualified = Math.min(
        ...m.winners.map((id) => qualifyingCount(histories[id] || [], asOfMatch)),
      );

      for (const id of m.winners) {
        const w = baseW * reliabilityWeight(winOppQualified);
        histories[id].push({
          matchId: m.id,
          date: m.date,
          matchRating: mrWin,
          weight: w,
          opponentIds: m.losers.slice(),
        });
        const avg = weightedAverage(histories[id], asOfMatch);
        if (avg != null) ratings[id] = avg;
        wins[id] = (wins[id] || 0) + 1;
        last[id] = { opponentId: m.losers[0], result: "win" };
      }
      for (const id of m.losers) {
        const w = baseW * reliabilityWeight(loseOppQualified);
        histories[id].push({
          matchId: m.id,
          date: m.date,
          matchRating: mrLose,
          weight: w,
          opponentIds: m.winners.slice(),
        });
        const avg = weightedAverage(histories[id], asOfMatch);
        if (avg != null) ratings[id] = avg;
        losses[id] = (losses[id] || 0) + 1;
        last[id] = { opponentId: m.winners[0], result: "loss" };
      }

      if (involved && focus) {
        const mr = m.winners.includes(focus) ? mrWin : mrLose;
        hooks?.onPlayerMatch?.({
          match: m,
          before: beforeFocus,
          after: ratings[focus],
          excluded: false,
          matchRating: mr,
        });
      }
    } else {
      // Still track W–L / last opponent for UI, but do not change rating.
      for (const id of m.winners) {
        wins[id] = (wins[id] || 0) + 1;
        last[id] = { opponentId: m.losers[0], result: "win" };
      }
      for (const id of m.losers) {
        losses[id] = (losses[id] || 0) + 1;
        last[id] = { opponentId: m.winners[0], result: "loss" };
      }
      if (involved && focus) {
        hooks?.onPlayerMatch?.({
          match: m,
          before: beforeFocus,
          after: beforeFocus,
          excluded: true,
        });
      }
    }
  }

  // Age published ratings to `now` (recency against today).
  for (const p of players) {
    const avg = weightedAverage(histories[p.id], now);
    ratings[p.id] = avg != null ? avg : utrSeedFromSelfLevel(p.ntrp);
  }

  return { ratings, histories, wins, losses, last };
}

/**
 * Rate the ladder for one format, optionally filtered to one city.
 * Matches only count when every participant is in the filtered player set
 * (same-city matches). Returns rows sorted by UTR-style rating desc.
 */
export function rateLadder(
  format: LadderFormat,
  now: Date = new Date("2026-10-07T12:00:00"),
  players: LadderPlayer[] = ladderPlayers,
  matches: LadderMatch[] = ladderMatches,
  cityId?: string | null,
): LadderRow[] {
  const scoped = cityId ? players.filter((p) => p.cityId === cityId) : players.slice();
  const { ratings, histories, wins, losses, last } = replayFormat(
    format,
    now,
    scoped,
    matches,
  );

  const names = Object.fromEntries(scoped.map((p) => [p.id, p.name]));
  const rows: LadderRow[] = scoped.map((p) => {
    const qualified = qualifyingCount(histories[p.id] || [], now);
    const played = (wins[p.id] || 0) + (losses[p.id] || 0);
    const L = last[p.id];
    return {
      ...p,
      rank: 0,
      rating: round1(ratings[p.id]),
      seed: round1(utrSeedFromSelfLevel(p.ntrp)),
      wins: wins[p.id] || 0,
      losses: losses[p.id] || 0,
      played: played > 0,
      qualifiedMatches: qualified,
      projected: qualified < PROJECTED_THRESHOLD,
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

/**
 * Same as rateLadder, plus rankDelta / ratingDelta vs the ladder state
 * before the most recent confirmed match that touches this city cohort.
 * Unchanged rows get 0; brand-new players (not in previous snapshot) get null.
 */
export function rateLadderWithDeltas(
  format: LadderFormat,
  now: Date = new Date(),
  players: LadderPlayer[] = ladderPlayers,
  matches: LadderMatch[] = ladderMatches,
  cityId?: string | null,
): LadderRow[] {
  const current = rateLadder(format, now, players, matches, cityId);
  const scoped = cityId ? players.filter((p) => p.cityId === cityId) : players.slice();
  const scopedIds = new Set(scoped.map((p) => p.id));
  const relevant = matches
    .filter(
      (m) =>
        m.format === format &&
        [...m.winners, ...m.losers].some((id) => scopedIds.has(id)),
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  if (relevant.length === 0) {
    return current.map((r) => ({ ...r, rankDelta: null, ratingDelta: null }));
  }

  const latestId = relevant[relevant.length - 1]!.id;
  const prevMatches = matches.filter((m) => m.id !== latestId);
  const previous = rateLadder(format, now, players, prevMatches, cityId);
  const prevById = Object.fromEntries(previous.map((r) => [r.id, r]));

  return current.map((r) => {
    const prev = prevById[r.id];
    if (!prev) return { ...r, rankDelta: null, ratingDelta: null };
    return {
      ...r,
      rankDelta: prev.rank - r.rank,
      ratingDelta: round1(r.rating - prev.rating),
    };
  });
}

export type PlayerMatchRecord = {
  id: string;
  date: string;
  format: LadderFormat;
  opponentName: string;
  result: "win" | "loss";
  sets: [number, number][];
  ratingAfter?: number;
  ratingDelta?: number;
};

/** Recent confirmed matches for one player (newest first). */
export function listPlayerRecentMatches(
  playerId: string,
  players: LadderPlayer[],
  matches: LadderMatch[],
  format?: LadderFormat | null,
  limit = 20,
): PlayerMatchRecord[] {
  const pid = String(playerId || "").trim();
  if (!pid) return [];
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const history = buildRatingHistory(pid, players, matches, new Date(), format || null);
  const fromHistory = history
    .filter((p) => p.kind === "match")
    .slice()
    .reverse()
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      date: p.date,
      format: (p.format || "singles") as LadderFormat,
      opponentName: p.opponentName || "",
      result: (p.result || "loss") as "win" | "loss",
      sets: (p.sets || []) as [number, number][],
      ratingAfter: p.rating,
      ratingDelta: p.delta,
    }));
  if (fromHistory.length > 0) return fromHistory;

  // Fallback if player has matches but history empty (edge): scan LadderMatch list
  const filtered = matches
    .filter(
      (m) =>
        (!format || m.format === format) &&
        (m.winners.includes(pid) || m.losers.includes(pid)),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, limit);
  return filtered.map((m) => {
    const won = m.winners.includes(pid);
    const oppIds = won ? m.losers : m.winners;
    return {
      id: m.id,
      date: m.date,
      format: m.format,
      opponentName: oppIds.map((id) => names[id] || id).join(" / "),
      result: won ? ("win" as const) : ("loss" as const),
      sets: m.sets || [],
    };
  });
}

export type RatingHistoryPoint = {
  id: string;
  kind: "seed" | "match";
  date: string;
  rating: number;
  ratingBefore?: number;
  delta?: number;
  opponentName?: string;
  result?: "win" | "loss";
  format?: LadderFormat;
  sets?: [number, number][];
  excluded?: boolean;
  matchRating?: number;
  projected?: boolean;
};

/**
 * Replay confirmed matches chronologically and record the player's
 * UTR-style rating after each match they played (plus the seed point).
 */
export function buildRatingHistory(
  playerId: string,
  players: LadderPlayer[] = ladderPlayers,
  matches: LadderMatch[] = ladderMatches,
  now: Date = new Date(),
  format?: LadderFormat | null,
): RatingHistoryPoint[] {
  const pid = String(playerId || "").trim();
  if (!pid) return [];

  const scoped = players.slice();
  if (!scoped.some((p) => p.id === pid)) return [];

  const names = Object.fromEntries(scoped.map((p) => [p.id, p.name]));
  const seed = round1(utrSeedFromSelfLevel(scoped.find((p) => p.id === pid)!.ntrp));

  const formats: LadderFormat[] = format
    ? [format]
    : (["singles", "doubles"] as LadderFormat[]);

  // History UI is usually format-scoped; when format is set, replay that only.
  // When null, singles and doubles stay independent — we concatenate by date
  // but each format keeps its own rating stream (points carry format).
  const points: RatingHistoryPoint[] = [];

  for (const fmt of formats) {
    const fmtMatches = matches.filter((m) => m.format === fmt);
    const firstDate =
      fmtMatches.slice().sort((a, b) => a.date.localeCompare(b.date))[0]?.date ||
      now.toISOString().slice(0, 10);

    if (format) {
      points.push({
        id: `seed:${pid}`,
        kind: "seed",
        date: firstDate,
        rating: seed,
        projected: true,
      });
    } else if (!points.some((p) => p.kind === "seed")) {
      points.push({
        id: `seed:${pid}`,
        kind: "seed",
        date: firstDate,
        rating: seed,
        projected: true,
      });
    }

    let qualifiedSoFar = 0;
    replayFormat(fmt, now, scoped, matches, {
      focusPlayerId: pid,
      onPlayerMatch: ({ match, before, after, excluded, matchRating }) => {
        if (!excluded) qualifiedSoFar += 1;
        const won = match.winners.includes(pid);
        const oppIds = won ? match.losers : match.winners;
        const opponentName = oppIds
          .map((id) => names[id] || id)
          .filter(Boolean)
          .join(" / ");
        points.push({
          id: match.id,
          kind: "match",
          date: match.date,
          rating: round1(after),
          ratingBefore: round1(before),
          delta: round1(after - before),
          opponentName,
          result: won ? "win" : "loss",
          format: match.format,
          sets: match.sets,
          excluded,
          matchRating: matchRating != null ? round2(matchRating) : undefined,
          projected: qualifiedSoFar < PROJECTED_THRESHOLD,
        });
      },
    });
  }

  points.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === "seed" ? -1 : 1) - (b.kind === "seed" ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );
  return points;
}

/** Exported for unit tests / fixtures. */
export const __utrInternals = {
  RATING_MIN,
  RATING_MAX,
  GAME_DIFF_SCALE,
  WINDOW_MATCHES,
  WINDOW_DAYS,
  PROJECTED_THRESHOLD,
  EXCLUDE_GAP,
  formatWeight,
  closenessWeight,
  reliabilityWeight,
  recencyWeight,
  weightedAverage,
  clampRating,
  round1,
  round2,
};
