#!/usr/bin/env node
/**
 * ZQ-105: keep only keeper player names; force 陈燕青 level=3 (seed 6.5);
 * restore Coach displayName; optionally cancel demo match that tanked rating.
 *
 * Usage on server (TENNIS_DATABASE_URL set):
 *   node deploy/rating-growth-fix/scripts/fix-db.cjs [--dry-run]
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.TENNIS_ROOT || "/opt/tennis-ai";
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run");
const CANCEL_MATCH_ID = "ms-1794220127391-3a1aa4";

const KEEPERS = {
  "18662147197": { displayName: "陈燕青", level: 3, cityId: "wuxi", role: "player" },
  u_pig: { displayName: "小猪", cityId: "wuxi", role: "player" },
  u_ivy: { displayName: "Ivy", cityId: "wuxi", role: "player" },
  u_shirley: { displayName: "Shirley", cityId: "wuxi", role: "player" },
};

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
  const auth = load("auth") || { users: {}, codes: {}, sessions: {} };
  auth.users = auth.users || {};
  const report = { cleared: [], levels: [], coachRestored: false, scores: null };

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
    if (phone === "13900001390") {
      u.displayName = "Coach";
      u.role = "coach";
      report.coachRestored = true;
      continue;
    }
    if (KEEPERS[phone]) continue;
    const before = String(u.displayName || "").trim();
    if (!before) continue;
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

  console.log(JSON.stringify({ ok: true, dryRun: DRY, report, named }, null, 2));
}

main();
