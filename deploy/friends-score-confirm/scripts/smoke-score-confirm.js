#!/usr/bin/env node
/**
 * Smoke: pending score does not affect ladder until opponent confirms.
 * Requires two session cookies via env A_COOKIE / B_COOKIE (tennis_session=...).
 */
const BASE = process.env.BASE || "https://yqchen.blog/tennis";

async function req(path, { method = "GET", cookie, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  const a = process.env.A_COOKIE;
  const b = process.env.B_COOKIE;
  if (!a || !b) {
    console.log("SKIP: set A_COOKIE and B_COOKIE for live smoke");
    process.exit(0);
  }
  const dir = await req("/api/friends/directory?role=player&includeSelf=1", { cookie: a });
  console.log("directory count", dir.data.count, "empty", dir.data.empty);
  const ladder0 = await req("/api/friends/ladder?format=singles", { cookie: a });
  console.log("ladder before", ladder0.data.count, "confirmedMatches", ladder0.data.confirmedMatches);

  // Names from sessions
  const sa = await req("/api/auth/session", { cookie: a });
  const sb = await req("/api/auth/session", { cookie: b });
  const nameA = sa.data.displayName;
  const nameB = sb.data.displayName;
  if (!nameA || !nameB) {
    console.error("both users need displayName");
    process.exit(1);
  }
  const created = await req("/api/friends/scores", {
    method: "POST",
    cookie: a,
    body: { playerA: nameA, playerB: nameB, sets: [[6, 4]], format: "singles" },
  });
  console.log("create", created.res.status, created.data.score?.status);
  if (!created.data.score?.id) process.exit(1);
  const ladder1 = await req("/api/friends/ladder?format=singles", { cookie: a });
  console.log("ladder pending (should same confirmedMatches)", ladder1.data.confirmedMatches);
  const conf = await req("/api/friends/scores/action", {
    method: "POST",
    cookie: b,
    body: { id: created.data.score.id, action: "confirm" },
  });
  console.log("confirm", conf.res.status, conf.data.rankingUpdated);
  const ladder2 = await req("/api/friends/ladder?format=singles", { cookie: a });
  console.log("ladder after", ladder2.data.confirmedMatches);
  if ((ladder2.data.confirmedMatches || 0) < (ladder1.data.confirmedMatches || 0) + 1) {
    console.error("FAIL: confirmed match not in ladder");
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
