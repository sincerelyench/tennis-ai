#!/usr/bin/env node
/**
 * ZQ-90 / ZQ-107: demo-seed cleanup only.
 *
 * HARD RULE: never wipe real registered users. The four keepers
 * (陈燕青、小猪、Ivy、Shirley) plus Coach are always preserved.
 * Display-name clears and score/intro drops apply ONLY to phones on the
 * DEMO_SEED_PHONES allowlist (known fake/QA seeds).
 *
 * Usage (on server, TENNIS_DATABASE_URL set):
 *   node trim-test-users-four.cjs --dry-run
 *   node trim-test-users-four.cjs --apply-demo-seeds-only
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.TENNIS_ROOT || process.cwd();
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run") || !process.argv.includes("--apply-demo-seeds-only");

const KEEPERS = ["陈燕青", "小猪", "Ivy", "Shirley"];
const COACH_PHONE = "13900001390";

/** Canonical keeper phone keys — never cleared. */
const KEEPER_PHONE_TARGETS = {
  "18662147197": "陈燕青",
  u_pig: "小猪",
  u_ivy: "Ivy",
  u_shirley: "Shirley",
};

/**
 * Allowlist of seeded demo/fake phones that may have displayName cleared.
 * Real registrants (e.g. 袁啸 / u__ddd123) must NEVER appear here.
 */
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

function isProtectedPhone(phone) {
  return Boolean(KEEPER_PHONE_TARGETS[phone]) || phone === COACH_PHONE;
}

function trimAuth(auth) {
  const users = auth.users && typeof auth.users === "object" ? auth.users : {};
  const report = {
    renamed: [],
    cleared: [],
    preserved: [],
    kept: [],
    beforeNamed: 0,
    afterNamed: 0,
  };

  for (const user of Object.values(users)) {
    if (!user || typeof user !== "object") continue;
    if (String(user.displayName || "").trim()) report.beforeNamed += 1;
  }

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
    if (!String(user.cityId || "").trim()) user.cityId = "wuxi";
    report.kept.push({ phone, displayName });
  }

  if (users[COACH_PHONE] && typeof users[COACH_PHONE] === "object") {
    users[COACH_PHONE].displayName = "Coach";
    users[COACH_PHONE].role = "coach";
  }

  for (const [phone, user] of Object.entries(users)) {
    if (!user || typeof user !== "object") continue;
    if (isProtectedPhone(phone)) continue;
    const before = String(user.displayName || "").trim();
    if (!before) continue;
    if (!DEMO_SEED_PHONES.has(phone)) {
      report.preserved.push({ phone, displayName: before, reason: "not-demo-seed" });
      continue;
    }
    user.displayName = "";
    report.cleared.push({ phone, from: before });
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

function partyIsDemoOrKeeper(phone, name) {
  const p = String(phone || "").trim();
  if (p && (KEEPER_PHONE_TARGETS[p] || DEMO_SEED_PHONES.has(p) || p === COACH_PHONE)) return true;
  if (!p && toKeeper(name)) return true;
  return false;
}

function trimScores(scoresDoc) {
  const scores = Array.isArray(scoresDoc.scores) ? scoresDoc.scores : [];
  const kept = [];
  const dropped = [];
  for (const score of scores) {
    if (!score || typeof score !== "object") continue;
    const aId = String(score.playerAId || "").trim();
    const bId = String(score.playerBId || "").trim();
    // Drop only when BOTH sides are demo seeds (not keepers/coach/real).
    const aDemo = DEMO_SEED_PHONES.has(aId);
    const bDemo = DEMO_SEED_PHONES.has(bId);
    if (aDemo && bDemo) {
      dropped.push(score.id || "?");
      continue;
    }
    const next = { ...score };
    for (const key of ["playerA", "playerB", "submitterName", "opponentName"]) {
      if (next[key] != null) next[key] = rewriteNameField(next[key]);
    }
    kept.push(next);
  }
  scoresDoc.scores = kept;
  return { kept: kept.length, dropped: dropped.length, droppedIds: dropped };
}

function introPartyPhone(intro, side) {
  if (side === "from") return String(intro.fromPhone || intro.fromId || "").trim();
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
    const bothDemo =
      DEMO_SEED_PHONES.has(fromPhone) && DEMO_SEED_PHONES.has(toPhone);
    if (bothDemo) {
      dropped.push(intro.id || "?");
      continue;
    }
    // Preserve intros that involve any real (non-demo-seed) party.
    if (!partyIsDemoOrKeeper(fromPhone, intro.fromName) || !partyIsDemoOrKeeper(toPhone, intro.toName)) {
      kept.push(intro);
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

  if (!process.argv.includes("--dry-run") && !process.argv.includes("--apply-demo-seeds-only")) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error:
            "Refusing to run: pass --dry-run or --apply-demo-seeds-only. " +
            "This script only clears DEMO_SEED_PHONES; real registrants are preserved.",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const auth = load("auth") || { users: {}, codes: {}, sessions: {} };
  const scores = load("scores") || { scores: [] };
  const intros = load("intros") || { intros: [] };

  const authReport = trimAuth(auth);
  const scoresReport = trimScores(scores);
  const introsReport = trimIntros(intros);

  const named = namedUsers(auth);
  const keeperOk = KEEPERS.every((k) => named.some((u) => u.displayName === k));
  const coachOk = named.some((u) => u.phone === COACH_PHONE && u.displayName === "Coach");

  const summary = {
    ok: keeperOk,
    dryRun: DRY,
    mode: "demo-seeds-allowlist-only",
    keepers: KEEPERS,
    coachOk,
    demoSeedPhoneCount: DEMO_SEED_PHONES.size,
    namedAfter: named,
    auth: authReport,
    scores: scoresReport,
    intros: introsReport,
  };

  if (!keeperOk) {
    console.error(JSON.stringify(summary, null, 2));
    throw new Error("trim failed to preserve the four keeper display names");
  }

  save("auth", auth);
  save("scores", scores);
  save("intros", intros);

  console.log(JSON.stringify(summary, null, 2));
}

main();
