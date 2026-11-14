import { cookies } from "next/headers";
import {
  getSession,
  isMatchHistoryPublicForPlayer,
  listDirectoryUsers,
  sessionCookie,
} from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  listPlayerRecentMatches,
  type LadderFormat,
  type LadderPlayer,
} from "@/lib/local-ladder";
import {
  getScoreById,
  isHiddenFromPublicFeed,
  listConfirmedLadderMatches,
  publicScore,
} from "@/lib/match-scores";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/player-matches?playerId=&format=singles|doubles
 * Recent confirmed 约球/比赛 results for one ladder player.
 * ZQ-115: each row includes confirmed highlight / description / comments.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const playerId = (url.searchParams.get("playerId") || "").trim();
  const playerName = (url.searchParams.get("name") || "").trim();
  const formatRaw = (url.searchParams.get("format") || "").trim();
  const format: LadderFormat | null =
    formatRaw === "doubles" ? "doubles" : formatRaw === "singles" ? "singles" : null;

  if (!playerId && !playerName) {
    return json(request, { error: "playerId or name required" }, 400);
  }

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
    players = players.filter((p) => p.id !== selfId && p.name !== selfName);
    players.push({
      id: selfId,
      name: selfName,
      ntrp:
        typeof session.level === "number" && [2, 2.5, 3, 3.5, 4, 4.5, 5].includes(session.level)
          ? session.level
          : 3.5,
      cityId: String(session.cityId || "").trim() || "unknown",
      placeKey: "",
      strokes: [],
    });
  }

  let resolvedId = playerId;
  let resolvedName = playerName;
  if (!resolvedId && playerName) {
    const hit = players.find(
      (p) => p.name.trim().toLowerCase() === playerName.trim().toLowerCase(),
    );
    resolvedId = hit?.id || "";
    resolvedName = hit?.name || playerName;
  } else if (resolvedId) {
    resolvedName = players.find((p) => p.id === resolvedId)?.name || playerName || resolvedId;
  }

  if (!resolvedId) {
    return json(request, {
      ok: true,
      playerId: "",
      name: resolvedName,
      count: 0,
      empty: true,
      historyHidden: false,
      matches: [],
    });
  }

  const viewingSelf = session.phone === resolvedId;
  // ZQ-139: profile 战绩可见 off → others do not see recent section under ladder.
  // Fresh auth reload (Next chunk cache). Self can still open own modal.
  if (
    !viewingSelf &&
    !isMatchHistoryPublicForPlayer({
      phone: resolvedId,
      displayName: resolvedName,
      fresh: true,
    })
  ) {
    return json(request, {
      ok: true,
      playerId: resolvedId,
      name: resolvedName,
      format: format || "all",
      count: 0,
      empty: true,
      historyHidden: true,
      matches: [],
      selfPhone: session.phone,
    });
  }
  const singles = listConfirmedLadderMatches("singles");
  const doubles = listConfirmedLadderMatches("doubles");
  const matches = format
    ? listConfirmedLadderMatches(format)
    : [...singles, ...doubles];

  const rows = listPlayerRecentMatches(resolvedId, players, matches, format, 20);
  const enriched = rows
    .map((row) => {
      const score = getScoreById(row.id);
      if (!score || score.status !== "confirmed") {
        return {
          ...row,
          description: "",
          highlightUrl: "",
          highlightName: "",
          comments: [],
          commentCount: 0,
          _hidden: false,
        };
      }
      // When profile is on, per-match 隐藏 (ZQ-138) still hides from public modal.
      const hiddenForPublic = !viewingSelf && isHiddenFromPublicFeed(score);
      if (hiddenForPublic) {
        return { ...row, _hidden: true as const };
      }
      const pub = publicScore(score);
      return {
        ...row,
        description: pub.description,
        highlightUrl: pub.highlightUrl,
        highlightName: pub.highlightName,
        comments: pub.comments,
        commentCount: pub.commentCount,
        score: pub,
        _hidden: false as const,
      };
    })
    .filter((row) => !row._hidden)
    .map(({ _hidden: _omit, ...row }) => row);

  return json(request, {
    ok: true,
    playerId: resolvedId,
    name: resolvedName,
    format: format || "all",
    count: enriched.length,
    empty: enriched.length === 0,
    historyHidden: false,
    matches: enriched,
    selfPhone: session.phone,
  });
}
