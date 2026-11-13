#!/usr/bin/env bash
# Verify: Wuxi 陈燕青 session should see awaiting invite with buddyId=18662147197
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"
cd "$ROOT"

node --input-type=module <<'NODE'
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

const root = process.cwd();
// Prefer compiled server chunk if present; else ts via next transpile is not available —
// load the same helpers the app uses by requiring built output.
const require = createRequire(path.join(root, "package.json"));

async function main() {
  // Use pg dump simulation of ownership when module import is awkward post-build.
  const { Client } = require("pg");
  const url = process.env.DATABASE_URL || process.env.TENNIS_DATABASE_URL;
  if (!url) {
    console.error("NO_DATABASE_URL");
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query(`
    SELECT id, status,
      payload->>'fromName' AS from_name,
      payload->>'toPhone' AS to_phone,
      payload->>'buddyId' AS buddy_id,
      payload->>'toName' AS to_name
    FROM match_intros
    WHERE status = 'awaiting_accept'
      AND (
        payload->>'toPhone' = '18662147197'
        OR payload->>'buddyId' = '18662147197'
      )
      AND payload->>'toName' = '陈燕青'
    ORDER BY payload->>'createdAt' DESC
  `);
  console.log(JSON.stringify({ awaitingForYanqing: rows }, null, 2));
  const ok = rows.some(
    (r) =>
      r.id === "mi-mwebxuf3-7a8cfb" &&
      (r.to_phone === "18662147197" || r.buddy_id === "18662147197"),
  );
  // Source check: buddyId preferred in createMatchIntro
  const fs = require("fs");
  const src = fs.readFileSync(path.join(root, "lib/match-intros.ts"), "utf8");
  const hasBuddyResolve = src.includes("resolveUserIdByName(toName, String(input.buddyId");
  const hasBuddyOwn = src.includes('side === "to"') && src.includes("intro.buddyId");
  console.log(
    JSON.stringify({
      VERIFY_ROW: ok,
      VERIFY_SRC_RESOLVE: hasBuddyResolve,
      VERIFY_SRC_OWN: hasBuddyOwn,
      VERIFY_OK: ok && hasBuddyResolve && hasBuddyOwn,
    }),
  );
  await client.end();
  if (!(ok && hasBuddyResolve && hasBuddyOwn)) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE
