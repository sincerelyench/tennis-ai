import { cookies } from "next/headers";
import { getSession, listDirectoryUsers, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import { rateLadder, type LadderFormat, type LadderPlayer } from "@/lib/local-ladder";
import { listConfirmedLadderMatches } from "@/lib/match-scores";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/ladder?cityId=&format=singles|doubles
 * Ladder from real logged-in users + confirmed match scores only.
 * Pending scores do not affect UTR. No users → count 0.
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

  const players: LadderPlayer[] = directory.map((u) => ({
    id: u.id,
    name: u.displayName,
    ntrp: u.level,
    cityId: u.cityId || "unknown",
    placeKey: "",
    strokes: [],
  }));

  const matches = listConfirmedLadderMatches(fmt);
  const rows = rateLadder(fmt, new Date(), players, matches, cityId);
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
      ntrp: r.ntrp,
      lastOpponentName: r.lastOpponentName || "",
      lastResult: r.lastResult || null,
    })),
    self: {
      phone: session.phone,
      displayName: session.displayName || "",
      cityId: session.cityId || "",
      level: session.level,
    },
  });
}
