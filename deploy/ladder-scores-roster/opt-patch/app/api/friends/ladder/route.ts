import { cookies } from "next/headers";
import { getSession, listDirectoryUsers, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  dedupePlayersByName,
  rateLadderWithDeltas,
  type LadderFormat,
  type LadderPlayer,
} from "@/lib/local-ladder";
import { listConfirmedLadderMatches } from "@/lib/match-scores";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/ladder?cityId=&format=singles|doubles
 * Ladder from real logged-in users + confirmed match scores only.
 * Includes rankDelta / ratingDelta vs previous city snapshot.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const cityId = (url.searchParams.get("cityId") || "").trim() || null;
  const format = (url.searchParams.get("format") || "singles") as LadderFormat;
  const fmt: LadderFormat = format === "doubles" ? "doubles" : "singles";

  const directory = listDirectoryUsers({
    role: "player",
    cityId: null,
    excludePhone: null,
  });

  let players: LadderPlayer[] = directory.map((u) => ({
    id: u.id,
    name: u.displayName,
    ntrp: u.level,
    cityId: u.cityId || "unknown",
    placeKey: "",
    strokes: [],
  }));

  const selfName = String(session.displayName || "").trim();
  if (selfName) {
    const selfId = session.phone;
    const selfCity = cityId || String(session.cityId || "").trim() || "unknown";
    const selfLevel =
      typeof session.level === "number" && [2, 2.5, 3, 3.5, 4, 4.5, 5].includes(session.level)
        ? session.level
        : 3;
    // Drop only this account / same-name twin in the city being viewed —
    // do not wipe same displayName in other cities.
    players = players.filter((p) => {
      if (p.id === selfId) return false;
      if (p.name === selfName && p.cityId === selfCity) return false;
      return true;
    });
    players.push({
      id: selfId,
      name: selfName,
      ntrp: selfLevel,
      cityId: selfCity,
      placeKey: "",
      strokes: [],
    });
  }

  // City scope before dedupe so phone-id twins in other cities cannot
  // replace local u_* keepers (displayName is enough to stay on ladder).
  if (cityId) {
    players = players.filter((p) => p.cityId === cityId);
  }
  players = dedupePlayersByName(players);

  const matches = listConfirmedLadderMatches(fmt);
  const rows = rateLadderWithDeltas(fmt, new Date(), players, matches, cityId);
  return json(request, {
    ok: true,
    format: fmt,
    cityId: cityId || "",
    count: rows.length,
    empty: rows.length === 0,
    confirmedMatches: matches.length,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      cityId: r.cityId,
      rank: r.rank,
      rating: r.rating,
      seed: r.seed,
      wins: r.wins,
      losses: r.losses,
      played: r.played,
      qualifiedMatches: r.qualifiedMatches,
      projected: r.projected,
      ntrp: r.ntrp,
      lastOpponentName: r.lastOpponentName || "",
      lastResult: r.lastResult || null,
      rankDelta: r.rankDelta ?? null,
      ratingDelta: r.ratingDelta ?? null,
    })),
    self: {
      phone: session.phone,
      displayName: session.displayName || "",
      cityId: session.cityId || "",
      level: session.level,
    },
  });
}
