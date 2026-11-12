#!/usr/bin/env node
/**
 * ZQ-92: rename keeper display 小朱 → 小猪 (u_pig) and rewrite related
 * scores/intros. Keepers stay exactly: 陈燕青、小猪、Ivy、Shirley.
 *
 * Usage (on server, from /opt/tennis-ai with TENNIS_DATABASE_URL set):
 *   node /path/to/rename-xiaozhu-to-xiaozhu.cjs [--dry-run]
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.TENNIS_ROOT || process.cwd();
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run");

const KEEPERS = ["陈燕青", "小猪", "Ivy", "Shirley"];

const KEEPER_PHONE_TARGETS = {
  "18662147197": "陈燕青",
  u_pig: "小猪",
  u_ivy: "Ivy",
  u_shirley: "Shirley",
};

const ALIAS_TO_KEEPER = {
  陈燕青: "陈燕青",
  chenyanqing: "陈燕青",
  "yanqing chen": "陈燕青",
  yanqing: "陈燕青",
  小猪: "小猪",
  小朱: "小猪",
  pig: "小猪",
  xiaozhu: "小猪",
  ivy: "Ivy",
  shirley: "Shirley",
};

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toKeeper(name) {
  const n = norm(name);
  if (!n) return "";
  if (ALIAS_TO_KEEPER[n]) return ALIAS_TO_KEEPER[n];
  for (const k of KEEPERS) {
    if (norm(k) === n) return k;
  }
  return "";
}

function runIo(args, input) {
  const result = spawnSync(process.execPath, [HELPER, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
    cwd: ROOT,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "user-db-io failed").trim());
  }
  return result.stdout || "";
}

function load(kind) {
  const raw = runIo(["load", kind]).trim();
  return raw ? JSON.parse(raw) : null;
}

function save(kind, data) {
  if (DRY) return;
  runIo(["save", kind], JSON.stringify(data));
}

function rewriteNameField(value) {
  const mapped = toKeeper(value);
  return mapped || String(value || "").trim();
}

function renameAuth(auth) {
  const users = auth.users && typeof auth.users === "object" ? auth.users : {};
  const report = { renamed: [], kept: [], missing: [] };

  for (const [phone, displayName] of Object.entries(KEEPER_PHONE_TARGETS)) {
    const user = users[phone];
    if (!user || typeof user !== "object") {
      report.missing.push({ phone, want: displayName });
      continue;
    }
    const before = String(user.displayName || "").trim();
    if (before !== displayName) {
      user.displayName = displayName;
      report.renamed.push({ phone, from: before, to: displayName });
    } else {
      report.kept.push({ phone, displayName });
    }
    if (!String(user.cityId || "").trim()) user.cityId = "wuxi";
  }

  // Also rewrite any stray 小朱 on non-keeper phones to empty (do not keep second 小猪).
  const keeperPhones = new Set(Object.keys(KEEPER_PHONE_TARGETS));
  for (const [phone, user] of Object.entries(users)) {
    if (!user || typeof user !== "object") continue;
    if (keeperPhones.has(phone)) continue;
    const before = String(user.displayName || "").trim();
    if (!before) continue;
    if (toKeeper(before) === "小猪" || before === "小朱") {
      user.displayName = "";
      report.renamed.push({ phone, from: before, to: "", note: "cleared-duplicate-alias" });
    }
  }

  auth.users = users;
  return report;
}

function rewriteScores(scoresDoc) {
  const scores = Array.isArray(scoresDoc.scores) ? scoresDoc.scores : [];
  let rewritten = 0;
  for (const score of scores) {
    if (!score || typeof score !== "object") continue;
    let changed = false;
    for (const key of ["playerA", "playerB", "submitterName", "opponentName"]) {
      if (score[key] == null) continue;
      const next = rewriteNameField(score[key]);
      if (next !== score[key]) {
        score[key] = next;
        changed = true;
      }
    }
    if (toKeeper(score.playerA) === "小猪") score.playerAId = "u_pig";
    if (toKeeper(score.playerB) === "小猪") score.playerBId = "u_pig";
    if (changed) rewritten += 1;
  }
  scoresDoc.scores = scores;
  return { count: scores.length, rewritten };
}

function rewriteIntros(introsDoc) {
  const intros = Array.isArray(introsDoc.intros) ? introsDoc.intros : [];
  let rewritten = 0;
  for (const intro of intros) {
    if (!intro || typeof intro !== "object") continue;
    let changed = false;
    for (const key of ["fromName", "toName"]) {
      if (intro[key] == null) continue;
      const next = rewriteNameField(intro[key]);
      if (next !== intro[key]) {
        intro[key] = next;
        changed = true;
      }
    }
    if (changed) rewritten += 1;
  }
  introsDoc.intros = intros;
  return { count: intros.length, rewritten };
}

function namedUsers(auth) {
  const out = [];
  for (const [phone, user] of Object.entries(auth.users || {})) {
    const dn = String((user && user.displayName) || "").trim();
    if (dn) out.push({ phone, displayName: dn, username: (user && user.username) || "" });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, "zh"));
  return out;
}

function main() {
  if (!fs.existsSync(HELPER)) {
    throw new Error(`missing ${HELPER}`);
  }

  const auth = load("auth") || { users: {}, codes: {}, sessions: {} };
  const scores = load("scores") || { scores: [] };
  const intros = load("intros") || { intros: [] };

  const authReport = renameAuth(auth);
  const scoresReport = rewriteScores(scores);
  const introsReport = rewriteIntros(intros);

  const named = namedUsers(auth);
  const namedSet = named.map((u) => u.displayName).sort((a, b) => a.localeCompare(b, "zh"));
  const ok =
    namedSet.length === KEEPERS.length &&
    KEEPERS.every((k) => namedSet.includes(k)) &&
    !namedSet.includes("小朱");

  const summary = {
    ok,
    dryRun: DRY,
    keepers: KEEPERS,
    namedAfter: named,
    auth: authReport,
    scores: scoresReport,
    intros: introsReport,
  };

  if (!ok) {
    console.error(JSON.stringify(summary, null, 2));
    throw new Error("rename did not leave exactly the four keeper display names with 小猪");
  }

  save("auth", auth);
  save("scores", scores);
  save("intros", intros);

  console.log(JSON.stringify(summary, null, 2));
}

main();
