#!/usr/bin/env node
/**
 * ZQ-90: keep only four test/demo display names in Postgres auth + related
 * friends scores/intros.
 *
 * Keepers: 陈燕青、小猪、Ivy、Shirley
 *
 * Usage (on server, from /opt/tennis-ai with TENNIS_DATABASE_URL set):
 *   node /path/to/trim-test-users-four.cjs [--dry-run]
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.TENNIS_ROOT || process.cwd();
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run");

const KEEPERS = ["陈燕青", "小猪", "Ivy", "Shirley"];

/** Canonical keeper phone keys we retain with a display name. */
const KEEPER_PHONE_TARGETS = {
  "18662147197": "陈燕青", // primary chenyanqing phone login
  u_pig: "小猪",
  u_ivy: "Ivy",
  u_shirley: "Shirley",
};

/** Alias → canonical keeper display name (case-insensitive match via norm). */
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

function trimAuth(auth) {
  const users = auth.users && typeof auth.users === "object" ? auth.users : {};
  const report = {
    renamed: [],
    cleared: [],
    kept: [],
    beforeNamed: 0,
    afterNamed: 0,
  };

  for (const user of Object.values(users)) {
    if (!user || typeof user !== "object") continue;
    const before = String(user.displayName || "").trim();
    if (before) report.beforeNamed += 1;
  }

  // First pass: force canonical names on known keeper phones.
  for (const [phone, displayName] of Object.entries(KEEPER_PHONE_TARGETS)) {
    const user = users[phone];
    if (!user || typeof user !== "object") {
      report.renamed.push({ phone, error: "missing-user", want: displayName });
      continue;
    }
    const before = String(user.displayName || "").trim();
    if (before !== displayName) {
      user.displayName = displayName;
      report.renamed.push({ phone, from: before, to: displayName });
    }
    // Ensure city so they appear in city ladder.
    if (!String(user.cityId || "").trim()) user.cityId = "wuxi";
    report.kept.push({ phone, displayName });
  }

  // Second pass: clear every non-keeper display name (including duplicate chenyanqing).
  const keeperPhones = new Set(Object.keys(KEEPER_PHONE_TARGETS));
  for (const [phone, user] of Object.entries(users)) {
    if (!user || typeof user !== "object") continue;
    if (keeperPhones.has(phone)) continue;
    const before = String(user.displayName || "").trim();
    const mapped = toKeeper(before);
    // Never keep a second account under a keeper label.
    if (before) {
      user.displayName = "";
      report.cleared.push({ phone, from: before, mappedWouldBe: mapped || null });
    }
  }

  for (const user of Object.values(users)) {
    if (!user || typeof user !== "object") continue;
    if (String(user.displayName || "").trim()) report.afterNamed += 1;
  }

  auth.users = users;
  return report;
}

function rewriteNameField(value) {
  const mapped = toKeeper(value);
  return mapped || String(value || "").trim();
}

function scoreTouchesOnlyKeepers(score) {
  const a = toKeeper(score.playerA);
  const b = toKeeper(score.playerB);
  return Boolean(a && b);
}

function trimScores(scoresDoc) {
  const scores = Array.isArray(scoresDoc.scores) ? scoresDoc.scores : [];
  const kept = [];
  const dropped = [];
  for (const score of scores) {
    if (!score || typeof score !== "object") continue;
    if (!scoreTouchesOnlyKeepers(score)) {
      dropped.push(score.id || "?");
      continue;
    }
    const next = { ...score };
    for (const key of ["playerA", "playerB", "submitterName", "opponentName"]) {
      if (next[key] != null) next[key] = rewriteNameField(next[key]);
    }
    // Re-bind ids to keeper phones when we know them.
    if (toKeeper(next.playerA) === "陈燕青") next.playerAId = "18662147197";
    if (toKeeper(next.playerA) === "小猪") next.playerAId = "u_pig";
    if (toKeeper(next.playerA) === "Ivy") next.playerAId = "u_ivy";
    if (toKeeper(next.playerA) === "Shirley") next.playerAId = "u_shirley";
    if (toKeeper(next.playerB) === "陈燕青") next.playerBId = "18662147197";
    if (toKeeper(next.playerB) === "小猪") next.playerBId = "u_pig";
    if (toKeeper(next.playerB) === "Ivy") next.playerBId = "u_ivy";
    if (toKeeper(next.playerB) === "Shirley") next.playerBId = "u_shirley";
    kept.push(next);
  }
  scoresDoc.scores = kept;
  return { kept: kept.length, dropped: dropped.length, droppedIds: dropped };
}

const KEEPER_PHONES = new Set(Object.keys(KEEPER_PHONE_TARGETS));

function introPartyPhone(intro, side) {
  if (side === "from") {
    return String(intro.fromPhone || intro.fromId || "").trim();
  }
  return String(intro.toPhone || intro.buddyId || intro.toId || "").trim();
}

function trimIntros(introsDoc) {
  const intros = Array.isArray(introsDoc.intros) ? introsDoc.intros : [];
  const kept = [];
  const dropped = [];
  for (const intro of intros) {
    if (!intro || typeof intro !== "object") continue;
    const fromPhone = introPartyPhone(intro, "from");
    const toPhone = introPartyPhone(intro, "to");
    const fromOk = fromPhone
      ? KEEPER_PHONES.has(fromPhone)
      : Boolean(toKeeper(intro.fromName));
    const toOk = toPhone
      ? KEEPER_PHONES.has(toPhone)
      : Boolean(toKeeper(intro.toName));
    // Keep only intros between two keeper accounts (prefer phone identity).
    if (!fromOk || !toOk || (fromPhone && toPhone && fromPhone === toPhone)) {
      dropped.push(intro.id || "?");
      continue;
    }
    const next = { ...intro };
    if (next.fromName != null) next.fromName = rewriteNameField(next.fromName);
    if (next.toName != null) next.toName = rewriteNameField(next.toName);
    kept.push(next);
  }
  introsDoc.intros = kept;
  return { kept: kept.length, dropped: dropped.length, droppedIds: dropped };
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

  const authReport = trimAuth(auth);
  const scoresReport = trimScores(scores);
  const introsReport = trimIntros(intros);

  const named = namedUsers(auth);
  const namedSet = named.map((u) => u.displayName).sort((a, b) => a.localeCompare(b, "zh"));
  const ok =
    namedSet.length === KEEPERS.length &&
    KEEPERS.every((k) => namedSet.includes(k));

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
    throw new Error("trim did not leave exactly the four keeper display names");
  }

  save("auth", auth);
  save("scores", scores);
  save("intros", intros);

  console.log(JSON.stringify(summary, null, 2));
}

main();
