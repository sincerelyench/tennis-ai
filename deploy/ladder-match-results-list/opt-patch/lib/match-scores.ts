/**
 * Friends match scores — pending until opponent confirms, then feed UTR ladder.
 * ZQ-115: highlight + description are attached with the pending score and only
 * become public when the opponent confirms (same gate as the score). After
 * confirm, any signed-in user may comment. Persisted in match_scores blob.
 */
import { randomBytes } from "crypto";
import type { LadderFormat, LadderMatch } from "@/lib/local-ladder";
import { listDirectoryUsers, sanitizeDisplayName } from "@/lib/auth-store";
import { userDbLoad, userDbSave } from "@/lib/user-db-sync";

export type ScoreStatus = "pending" | "confirmed" | "rejected";

export type MatchComment = {
  id: string;
  authorPhone: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type MatchScore = {
  id: string;
  status: ScoreStatus;
  format: LadderFormat;
  createdAt: string;
  confirmedAt?: string;
  rejectedAt?: string;
  /** Phone of the user who submitted the score. */
  submitterPhone: string;
  submitterName: string;
  playerA: string;
  playerB: string;
  /** Resolved directory ids (phones) when names match logged-in users. */
  playerAId?: string;
  playerBId?: string;
  /** Opponent who must confirm (the side that is not the submitter). */
  opponentPhone?: string;
  opponentName: string;
  sets: [number, number][];
  winner: "A" | "B";
  /** 精彩集锦 — text description (submitted with score; public after confirm). */
  description?: string;
  /** Public URL for highlight video (upload or external). */
  highlightUrl?: string;
  highlightName?: string;
  highlightUpdatedAt?: string;
  highlightUpdatedBy?: string;
  comments?: MatchComment[];
};

type Db = { scores: MatchScore[] };

const empty = (): Db => ({ scores: [] });

let cache: Db | null = null;

function load(): Db {
  if (cache) return cache;
  try {
    const parsed = userDbLoad("scores") as Db;
    cache = { scores: Array.isArray(parsed?.scores) ? parsed.scores : [] };
  } catch {
    cache = empty();
  }
  return cache;
}

function save(db: Db) {
  cache = db;
  userDbSave("scores", db);
}

function normName(raw: string) {
  return sanitizeDisplayName(raw).toLowerCase();
}

function resolveUserIdByName(name: string): string | undefined {
  const n = normName(name);
  if (!n) return undefined;
  const users = listDirectoryUsers({ role: "any" }).filter((u) => normName(u.displayName) === n);
  if (users.length === 0) return undefined;
  // Prefer real CN mobile accounts over synthetic u_* ids when names collide.
  const phoneLike = users.find((u) => /^1\d{10}$/.test(String(u.phone || "")));
  return (phoneLike || users[0])?.phone;
}

function sanitizeDescription(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function sanitizeHighlightUrl(raw: unknown): string {
  const url = String(raw ?? "").trim().slice(0, 2000);
  if (!url) return "";
  if (url.startsWith("/tennis/match-highlights/")) return url;
  if (url.startsWith("/tennis/coach-demos/")) return url;
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {
    /* invalid */
  }
  return "";
}

/** Latest confirmed score between two display names (either orientation). */
export function findConfirmedScoreBetween(playerNameA: string, playerNameB: string) {
  const a = normName(playerNameA);
  const b = normName(playerNameB);
  if (!a || !b) return null;
  const db = load();
  const hits = db.scores.filter((s) => {
    if (s.status !== "confirmed") return false;
    const pa = normName(s.playerA);
    const pb = normName(s.playerB);
    return (pa === a && pb === b) || (pa === b && pb === a);
  });
  hits.sort((x, y) =>
    String(y.confirmedAt || y.createdAt || "").localeCompare(String(x.confirmedAt || x.createdAt || "")),
  );
  return hits[0] || null;
}

export function winnerFromSets(sets: [number, number][]): "A" | "B" | null {
  let wa = 0;
  let wb = 0;
  for (const [a, b] of sets) {
    if (a === b) continue;
    if (a > b) wa += 1;
    else wb += 1;
  }
  if (wa === wb) return null;
  return wa > wb ? "A" : "B";
}

export function createPendingScore(input: {
  submitterPhone: string;
  submitterName: string;
  playerA: string;
  playerB: string;
  sets: [number, number][];
  format?: LadderFormat;
  /** Optional 精彩集锦 — travels with pending score; public after confirm. */
  description?: string;
  highlightUrl?: string;
  highlightName?: string;
}): { ok: true; score: MatchScore } | { error: string } {
  const playerA = sanitizeDisplayName(input.playerA);
  const playerB = sanitizeDisplayName(input.playerB);
  if (!playerA || !playerB) return { error: "Enter both player names" };
  if (normName(playerA) === normName(playerB)) return { error: "Names must be different" };
  if (!input.sets.length) return { error: "Enter at least one set" };
  for (const [a, b] of input.sets) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 || a > 99 || b > 99) {
      return { error: "Use numbers like 6–4" };
    }
    if (a === 0 && b === 0) return { error: "Use numbers like 6–4" };
  }
  const winner = winnerFromSets(input.sets);
  if (!winner) return { error: "One side must win more sets" };

  const submitterName = sanitizeDisplayName(input.submitterName);
  if (!submitterName) return { error: "Set your display name first" };
  const submitterNorm = normName(submitterName);
  const aNorm = normName(playerA);
  const bNorm = normName(playerB);
  // Submitter must be one of the two named players
  if (submitterNorm !== aNorm && submitterNorm !== bNorm) {
    return { error: "You must be one of the two players" };
  }
  const opponentName = submitterNorm === aNorm ? playerB : playerA;
  const playerAId = resolveUserIdByName(playerA);
  const playerBId = resolveUserIdByName(playerB);
  const opponentPhone = resolveUserIdByName(opponentName);

  let highlightUrl: string | undefined;
  let highlightName: string | undefined;
  if (typeof input.highlightUrl === "string" && input.highlightUrl.trim()) {
    const url = sanitizeHighlightUrl(input.highlightUrl);
    if (!url) return { error: "Invalid highlight URL" };
    highlightUrl = url;
    const name = String(input.highlightName || "")
      .trim()
      .slice(0, 200);
    if (name) highlightName = name;
  }
  const description =
    typeof input.description === "string" ? sanitizeDescription(input.description) : "";

  const now = new Date().toISOString();
  const score: MatchScore = {
    id: `ms-${Date.now()}-${randomBytes(3).toString("hex")}`,
    status: "pending",
    format: input.format === "doubles" ? "doubles" : "singles",
    createdAt: now,
    submitterPhone: input.submitterPhone,
    submitterName,
    playerA,
    playerB,
    playerAId,
    playerBId,
    opponentPhone,
    opponentName,
    sets: input.sets.map(([a, b]) => [Math.floor(a), Math.floor(b)] as [number, number]),
    winner,
    comments: [],
  };
  if (description) score.description = description;
  if (highlightUrl) {
    score.highlightUrl = highlightUrl;
    if (highlightName) score.highlightName = highlightName;
    score.highlightUpdatedAt = now;
    score.highlightUpdatedBy = input.submitterPhone;
  }

  const db = load();
  db.scores.unshift(score);
  db.scores = db.scores.slice(0, 500);
  save(db);
  return { ok: true, score };
}

function isOpponent(session: { phone: string; displayName: string }, score: MatchScore): boolean {
  if (score.submitterPhone === session.phone) return false;
  if (score.opponentPhone && score.opponentPhone === session.phone) return true;
  const my = normName(session.displayName);
  if (!my) return false;
  return my === normName(score.opponentName);
}

/** Either named player (or submitter / resolved ids) may edit highlight + description. */
export function isScoreParticipant(
  session: { phone: string; displayName: string },
  score: MatchScore,
): boolean {
  if (score.submitterPhone === session.phone) return true;
  if (score.opponentPhone && score.opponentPhone === session.phone) return true;
  if (score.playerAId && score.playerAId === session.phone) return true;
  if (score.playerBId && score.playerBId === session.phone) return true;
  const my = normName(session.displayName);
  if (!my) return false;
  return my === normName(score.playerA) || my === normName(score.playerB);
}

export function getScoreById(id: string): MatchScore | null {
  const db = load();
  return db.scores.find((s) => s.id === id) || null;
}

export function confirmScore(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; score: MatchScore } | { error: string; status?: number } {
  const db = load();
  const score = db.scores.find((s) => s.id === id);
  if (!score) return { error: "Score not found", status: 404 };
  if (score.status !== "pending") return { error: "Score is not pending", status: 409 };
  if (!isOpponent(session, score)) {
    return { error: "Only the opponent can confirm this score", status: 403 };
  }
  // Re-resolve ids in case opponent just set display name
  score.playerAId = score.playerAId || resolveUserIdByName(score.playerA) || undefined;
  score.playerBId = score.playerBId || resolveUserIdByName(score.playerB) || undefined;
  if (normName(session.displayName) === normName(score.playerA)) score.playerAId = session.phone;
  if (normName(session.displayName) === normName(score.playerB)) score.playerBId = session.phone;
  score.status = "confirmed";
  score.confirmedAt = new Date().toISOString();
  score.opponentPhone = session.phone;
  save(db);
  return { ok: true, score };
}

export function rejectScore(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; score: MatchScore } | { error: string; status?: number } {
  const db = load();
  const score = db.scores.find((s) => s.id === id);
  if (!score) return { error: "Score not found", status: 404 };
  if (score.status !== "pending") return { error: "Score is not pending", status: 409 };
  if (!isOpponent(session, score)) {
    return { error: "Only the opponent can reject this score", status: 403 };
  }
  score.status = "rejected";
  score.rejectedAt = new Date().toISOString();
  score.opponentPhone = session.phone;
  save(db);
  return { ok: true, score };
}

export function listScoresForUser(session: { phone: string; displayName: string }): {
  pendingForMe: MatchScore[];
  minePending: MatchScore[];
  confirmed: MatchScore[];
  count: number;
} {
  const db = load();
  const pendingForMe: MatchScore[] = [];
  const minePending: MatchScore[] = [];
  const confirmed: MatchScore[] = [];
  for (const s of db.scores) {
    if (s.status === "pending") {
      if (isOpponent(session, s)) pendingForMe.push(s);
      else if (s.submitterPhone === session.phone) minePending.push(s);
    } else if (s.status === "confirmed") {
      const my = normName(session.displayName);
      const involved =
        s.submitterPhone === session.phone ||
        s.opponentPhone === session.phone ||
        s.playerAId === session.phone ||
        s.playerBId === session.phone ||
        (my && (my === normName(s.playerA) || my === normName(s.playerB)));
      if (involved) confirmed.push(s);
    }
  }
  return {
    pendingForMe,
    minePending,
    confirmed,
    count: pendingForMe.length + minePending.length + confirmed.length,
  };
}

/** All confirmed scores as ladder matches (UTR feed). */
export function listConfirmedLadderMatches(format?: LadderFormat | null): LadderMatch[] {
  const db = load();
  const out: LadderMatch[] = [];
  for (const s of db.scores) {
    if (s.status !== "confirmed") continue;
    if (format && s.format !== format) continue;
    const aId = s.playerAId || resolveUserIdByName(s.playerA);
    const bId = s.playerBId || resolveUserIdByName(s.playerB);
    if (!aId || !bId) continue; // need both users in directory for ladder
    const winners = s.winner === "A" ? [aId] : [bId];
    const losers = s.winner === "A" ? [bId] : [aId];
    // Normalize set orientation to winner-first for ladder actualFromSets
    const sets = s.sets.map(([ga, gb]) =>
      s.winner === "A" ? ([ga, gb] as [number, number]) : ([gb, ga] as [number, number]),
    );
    out.push({
      id: s.id,
      date: (s.confirmedAt || s.createdAt).slice(0, 10),
      format: s.format,
      winners,
      losers,
      sets,
    });
  }
  return out;
}

/**
 * Confirmed scores for the local ladder city context.
 * A match is in-city when either player has a directory profile in that city
 * (by id or display name). Newest confirmed first.
 */
export function listConfirmedScoresForCity(opts: {
  cityId?: string | null;
  format?: LadderFormat | null;
}): MatchScore[] {
  const city = String(opts.cityId || "").trim();
  const format = opts.format || null;
  const db = load();
  const directory = listDirectoryUsers({
    role: "any",
    cityId: null,
    excludePhone: null,
  });

  function playerInCity(name: string, id?: string): boolean {
    if (!city) return true;
    const n = normName(name);
    return directory.some((u) => {
      const cid = String(u.cityId || "").trim();
      if (cid !== city) return false;
      if (id && (u.phone === id || u.id === id)) return true;
      return Boolean(n) && normName(u.displayName) === n;
    });
  }

  const out: MatchScore[] = [];
  for (const s of db.scores) {
    if (s.status !== "confirmed") continue;
    if (format && s.format !== format) continue;
    const aId = s.playerAId || resolveUserIdByName(s.playerA);
    const bId = s.playerBId || resolveUserIdByName(s.playerB);
    if (!playerInCity(s.playerA, aId) && !playerInCity(s.playerB, bId)) continue;
    out.push(s);
  }
  out.sort((a, b) =>
    String(b.confirmedAt || b.createdAt || "").localeCompare(String(a.confirmedAt || a.createdAt || "")),
  );
  return out;
}

/**
 * ZQ-115: highlight/description may only change while the score is still pending
 * (same bundle the opponent will confirm). Frozen after confirm/reject.
 */
export function updateScoreHighlight(
  id: string,
  session: { phone: string; displayName: string },
  input: { description?: string; highlightUrl?: string; highlightName?: string; clearHighlight?: boolean },
): { ok: true; score: MatchScore } | { error: string; status?: number } {
  const db = load();
  const score = db.scores.find((s) => s.id === id);
  if (!score) return { error: "Score not found", status: 404 };
  if (score.status !== "pending") {
    return { error: "Highlight is locked after score is confirmed", status: 409 };
  }
  if (!isScoreParticipant(session, score)) {
    return { error: "Only match players can edit the highlight", status: 403 };
  }

  if (typeof input.description === "string") {
    score.description = sanitizeDescription(input.description);
  }
  if (input.clearHighlight) {
    score.highlightUrl = undefined;
    score.highlightName = undefined;
  } else if (typeof input.highlightUrl === "string") {
    const url = sanitizeHighlightUrl(input.highlightUrl);
    if (!url && input.highlightUrl.trim()) {
      return { error: "Invalid highlight URL", status: 400 };
    }
    if (url) {
      score.highlightUrl = url;
      const name = String(input.highlightName || "")
        .trim()
        .slice(0, 200);
      if (name) score.highlightName = name;
    }
  }
  score.highlightUpdatedAt = new Date().toISOString();
  score.highlightUpdatedBy = session.phone;
  save(db);
  return { ok: true, score };
}

export function addScoreComment(
  id: string,
  session: { phone: string; displayName: string },
  bodyRaw: string,
): { ok: true; score: MatchScore; comment: MatchComment } | { error: string; status?: number } {
  const body = String(bodyRaw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
  if (!body) return { error: "Comment is empty", status: 400 };

  const db = load();
  const score = db.scores.find((s) => s.id === id);
  if (!score) return { error: "Score not found", status: 404 };
  if (score.status !== "confirmed") {
    return { error: "Comments open after the score is confirmed", status: 409 };
  }

  const authorName = sanitizeDisplayName(session.displayName) || "球友";
  const comment: MatchComment = {
    id: `mc-${Date.now()}-${randomBytes(3).toString("hex")}`,
    authorPhone: session.phone,
    authorName,
    body,
    createdAt: new Date().toISOString(),
  };
  if (!Array.isArray(score.comments)) score.comments = [];
  score.comments.push(comment);
  if (score.comments.length > 200) score.comments = score.comments.slice(-200);
  save(db);
  return { ok: true, score, comment };
}

export function deleteScoreComment(
  id: string,
  commentId: string,
  session: { phone: string; displayName: string },
): { ok: true; score: MatchScore } | { error: string; status?: number } {
  const db = load();
  const score = db.scores.find((s) => s.id === id);
  if (!score) return { error: "Score not found", status: 404 };
  const list = Array.isArray(score.comments) ? score.comments : [];
  const idx = list.findIndex((c) => c.id === commentId);
  if (idx < 0) return { error: "Comment not found", status: 404 };
  const comment = list[idx];
  if (comment.authorPhone !== session.phone) {
    return { error: "Only the author can delete this comment", status: 403 };
  }
  list.splice(idx, 1);
  score.comments = list;
  save(db);
  return { ok: true, score };
}

export function publicComment(c: MatchComment) {
  return {
    id: c.id,
    authorName: c.authorName,
    body: c.body,
    createdAt: c.createdAt,
  };
}

/**
 * @param revealPendingMedia when false, strip highlight/description on pending
 *   scores (for non-participant GETs). Participants / listScores keep full fields.
 */
export function publicScore(s: MatchScore, opts?: { revealPendingMedia?: boolean }) {
  const comments = Array.isArray(s.comments) ? s.comments : [];
  const confirmed = s.status === "confirmed";
  const revealMedia = confirmed || opts?.revealPendingMedia !== false;
  return {
    id: s.id,
    status: s.status,
    format: s.format,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt || null,
    rejectedAt: s.rejectedAt || null,
    submitterName: s.submitterName,
    playerA: s.playerA,
    playerB: s.playerB,
    opponentName: s.opponentName,
    sets: s.sets,
    winner: s.winner,
    needsConfirm: s.status === "pending",
    description: revealMedia ? s.description || "" : "",
    highlightUrl: revealMedia ? s.highlightUrl || "" : "",
    highlightName: revealMedia ? s.highlightName || "" : "",
    highlightUpdatedAt: revealMedia ? s.highlightUpdatedAt || null : null,
    comments: confirmed ? comments.map(publicComment) : [],
    commentCount: confirmed ? comments.length : 0,
    highlightPending: s.status === "pending" && Boolean(s.description || s.highlightUrl),
  };
}
