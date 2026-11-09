import { cookies } from "next/headers";
import { getSession, listDirectoryUsers, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  buildRatingHistory,
  ensureSelfInPlayers,
  playersFromDirectory,
  type LadderFormat,
} from "@/lib/local-ladder";
import { listConfirmedLadderMatches } from "@/lib/match-scores";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/rating-history?format=singles|doubles
 * Chronological UTR-like rating points for the signed-in player.
 * Seed + each confirmed match that updated their rating.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const formatRaw = (url.searchParams.get("format") || "singles").trim();
  const format: LadderFormat = formatRaw === "doubles" ? "doubles" : "singles";

  const directory = listDirectoryUsers({
    role: "player",
    cityId: null,
    excludePhone: null,
  });
  let players = playersFromDirectory(directory);
  players = ensureSelfInPlayers(players, {
    id: session.phone,
    phone: session.phone,
    name: session.displayName,
    displayName: session.displayName,
    level: session.level,
    cityId: session.cityId,
  });

  const selfId = String(session.phone || "").trim();
  const matches = listConfirmedLadderMatches(format);
  const points = selfId
    ? buildRatingHistory(selfId, players, matches, new Date(), format)
    : [];

  const matchPoints = points.filter((p) => p.kind === "match");
  const counted = matchPoints.filter((p) => !p.excluded);
  const first = points[0] || null;
  const latest = points[points.length - 1] || null;
  const delta =
    first && latest && points.length > 1
      ? Math.round((latest.rating - first.rating) * 10) / 10
      : 0;
  const projected = counted.length < 5;

  return json(request, {
    ok: true,
    format,
    empty: matchPoints.length === 0,
    count: points.length,
    matchCount: matchPoints.length,
    qualifiedMatches: counted.length,
    projected,
    seed: first?.rating ?? null,
    current: latest?.rating ?? null,
    delta,
    points,
    self: {
      phone: session.phone,
      displayName: session.displayName || "",
      cityId: session.cityId || "",
      level: session.level,
    },
  });
}
