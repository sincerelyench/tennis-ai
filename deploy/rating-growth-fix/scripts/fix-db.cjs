#!/usr/bin/env node
/**
 * ZQ-105 / ZQ-107: rating helpers for keepers + Coach.
 *
 * HARD RULE (2026-11-13): do NOT clear display names of real registrants.
 * Only DEMO_SEED_PHONES may have displayName wiped. Keepers and Coach are
 * always preserved/restored.
 *
 * Usage on server (TENNIS_DATABASE_URL set):
 *   node deploy/rating-growth-fix/scripts/fix-db.cjs --dry-run
 *   node deploy/rating-growth-fix/scripts/fix-db.cjs --apply-demo-seeds-only
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.TENNIS_ROOT || "/opt/tennis-ai";
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run") || !process.argv.includes("--apply-demo-seeds-only");
const CANCEL_MATCH_ID = "ms-1794220127391-3a1aa4";
const COACH_PHONE = "13900001390";

const KEEPERS = {
  "18662147197": { displayName: "陈燕青", level: 3, cityId: "wuxi", role: "player" },
  u_pig: { displayName: "小猪", cityId: "wuxi", role: "player" },
  u_ivy: { displayName: "Ivy", cityId: "wuxi", role: "player" },
  u_shirley: { displayName: "Shirley", cityId: "wuxi", role: "player" },
};

/** Known fake/QA seed phones only — never include real registrants (袁啸 etc.). */
const DEMO_SEED_PHONES = new Set([
  "u_111",
  "u_zqdemo",
  "13600005555",
  "13700001234",
  "13800000001",
  "13800138888",
  "13900001111",
  "13900003333",
  "13900009999",
  "u_restoreqa",
  "u_zq85tabfix",
  "u_zqsig94338",
  "u_zqui388569",
  "u_zqhelp54274",
  "wx_mock_1eb62463a357942308a402bf",
  "wx_mock_2163cb82a8e1a9f38b3af3a2",
  "wx_mock_234de81b1372c186297f4eb9",
  "wx_mock_26eb2374489e74b40c9ba4fa",
  "wx_mock_4a906d7d930f47d3aab5cf87",
  "wx_mock_5276f704d8d56d0dbb11d8f3",
  "wx_mock_8cd81fb153c1752088b98d21",
  "wx_mock_9667fbf3f6804919146b082c",
  "wx_mock_b06e051f98b4e3b3a9986ad1",
  "wx_mock_c8e63946423b2a28038a1328",
]);

function runIo(args, input) {
  const r = spawnSync(process.execPath, [HELPER, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
    cwd: ROOT,
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "user-db-io failed").trim());
  return r.stdout || "";
}

function load(kind) {
  const raw = runIo(["load", kind]).trim();
  return raw ? JSON.parse(raw) : null;
}

function save(kind, data) {
  if (DRY) return;
  runIo(["save", kind], JSON.stringify(data));
}

function main() {
  if (!fs.existsSync(HELPER)) throw new Error(`missing ${HELPER}`);

  if (!process.argv.includes("--dry-run") && !process.argv.includes("--apply-demo-seeds-only")) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error:
            "Refusing to run without --dry-run or --apply-demo-seeds-only. " +
            "Will not clear non-demo registered users.",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const auth = load("auth") || { users: {}, codes: {}, sessions: {} };
  auth.users = auth.users || {};
  const report = { cleared: [], preserved: [], levels: [], coachRestored: false, scores: null };

  for (const [phone, patch] of Object.entries(KEEPERS)) {
    const u = auth.users[phone] || { phone, createdAt: new Date().toISOString() };
    u.displayName = patch.displayName;
    u.role = patch.role || u.role || "player";
    if (!String(u.cityId || "").trim()) u.cityId = patch.cityId;
    if (patch.level != null) {
      report.levels.push({ phone, from: u.level ?? null, to: patch.level });
      u.level = patch.level;
    }
    auth.users[phone] = u;
  }

  for (const [phone, u] of Object.entries(auth.users)) {
    if (!u || typeof u !== "object") continue;
    if (phone === COACH_PHONE) {
      u.displayName = "Coach";
      u.role = "coach";
      report.coachRestored = true;
      continue;
    }
    if (KEEPERS[phone]) continue;
    const before = String(u.displayName || "").trim();
    if (!before) continue;
    if (!DEMO_SEED_PHONES.has(phone)) {
      report.preserved.push({ phone, displayName: before, reason: "not-demo-seed" });
      continue;
    }
    u.displayName = "";
    report.cleared.push({ phone, from: before });
  }

  const scoresDoc = load("scores") || { scores: [] };
  const scores = Array.isArray(scoresDoc.scores) ? scoresDoc.scores : [];
  let changed = 0;
  for (const s of scores) {
    if (!s || s.id !== CANCEL_MATCH_ID) continue;
    if (s.status === "confirmed") {
      s.status = "cancelled";
      s.cancelledAt = new Date().toISOString();
      s.cancelReason = "rating-growth-fix: restore 陈燕青 seed 6.5";
      changed += 1;
    }
  }
  scoresDoc.scores = scores;
  report.scores = { changed, id: CANCEL_MATCH_ID };

  if (!DRY) {
    save("auth", auth);
    save("scores", scoresDoc);
  }

  const named = Object.entries(auth.users)
    .filter(([, u]) => String((u && u.displayName) || "").trim())
    .map(([phone, u]) => ({
      phone,
      displayName: u.displayName,
      level: u.level ?? null,
      role: u.role,
    }));

  console.log(JSON.stringify({ ok: true, dryRun: DRY, mode: "demo-seeds-allowlist-only", report, named }, null, 2));
}

main();
