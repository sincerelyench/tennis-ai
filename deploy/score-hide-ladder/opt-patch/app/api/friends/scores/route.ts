import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  createPendingScore,
  listConfirmedScoresForCity,
  listScoresForUser,
  publicScore,
  type MatchScore,
} from "@/lib/match-scores";
import type { LadderFormat } from "@/lib/local-ladder";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/scores
 * Default: pending-for-me, my pending, and confirmed matches for the session.
 * ?scope=city&cityId=&format= : all confirmed scores in the ladder city context
 * (same city filter as 本地排行). Empty → count 0 (no demo rows).
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") || "").trim().toLowerCase();
  if (scope === "city") {
    const cityId = (url.searchParams.get("cityId") || "").trim();
    const formatRaw = (url.searchParams.get("format") || "").trim();
    const format: LadderFormat | null =
      formatRaw === "doubles" ? "doubles" : formatRaw === "singles" ? "singles" : null;
    const matches = listConfirmedScoresForCity({ cityId: cityId || null, format });
    return json(request, {
      ok: true,
      scope: "city",
      cityId: cityId || "",
      format: format || "",
      matches: matches.map((s) => publicScore(s)),
      count: matches.length,
      empty: matches.length === 0,
      self: {
        phone: session.phone,
        displayName: session.displayName || "",
      },
    });
  }

  const listed = listScoresForUser({
    phone: session.phone,
    displayName: session.displayName || "",
  });

  return json(request, {
    ok: true,
    pendingForMe: listed.pendingForMe.map((s) => publicScore(s)),
    minePending: listed.minePending.map((s) => publicScore(s)),
    confirmed: listed.confirmed.map((s) => publicScore(s)),
    count: listed.count,
    empty: listed.count === 0,
    self: {
      phone: session.phone,
      displayName: session.displayName || "",
    },
  });
}

/**
 * POST /api/friends/scores
 * Create a pending score. Opponent must confirm before ranking/UTR update.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: {
    playerA?: string;
    playerB?: string;
    sets?: [number, number][];
    format?: LadderFormat;
    description?: string;
    highlightUrl?: string;
    highlightName?: string;
    /** true = 隐藏 from ladder city「比赛结果」; omit/false = 展示 (default). */
    hideFromPublic?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const sets = Array.isArray(body.sets) ? body.sets : [];
  const result = createPendingScore({
    submitterPhone: session.phone,
    submitterName: session.displayName || String(body.playerA || ""),
    playerA: String(body.playerA || ""),
    playerB: String(body.playerB || ""),
    sets,
    format: body.format,
    description: typeof body.description === "string" ? body.description : undefined,
    highlightUrl: typeof body.highlightUrl === "string" ? body.highlightUrl : undefined,
    highlightName: typeof body.highlightName === "string" ? body.highlightName : undefined,
    hideFromPublic: body.hideFromPublic === true,
  });
  if ("error" in result) return json(request, { error: result.error }, 400);

  const score: MatchScore = result.score;
  return json(request, {
    ok: true,
    pending: true,
    score: publicScore(score, { revealPendingMedia: true }),
    message: "Waiting for opponent confirmation",
  });
}
