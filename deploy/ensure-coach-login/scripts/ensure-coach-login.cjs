#!/usr/bin/env node
/**
 * Ensure demo coach account: username Coach / password 1122 / role coach.
 * Prefer updating existing DEMO coach phone (13900001390); else create it.
 *
 * Usage (on server, from /opt/tennis-ai with TENNIS_DATABASE_URL set):
 *   node scripts/ensure-coach-login.cjs [--dry-run]
 */
"use strict";

const { spawnSync } = require("child_process");
const { randomBytes, scryptSync } = require("crypto");
const path = require("path");

const ROOT = process.env.TENNIS_ROOT || process.cwd();
const HELPER = path.join(ROOT, "scripts", "user-db-io.cjs");
const DRY = process.argv.includes("--dry-run");

const DEMO_COACH_PHONE = "13900001390";
const USERNAME = "coach";
const PASSWORD = "1122";
const DISPLAY_NAME = "Coach";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
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

function loadAuth() {
  const raw = runIo(["load", "auth"]).trim();
  return raw ? JSON.parse(raw) : { users: {}, codes: {}, sessions: {} };
}

function saveAuth(data) {
  if (DRY) return;
  runIo(["save", "auth"], JSON.stringify(data));
}

function findExistingCoach(users) {
  if (users[DEMO_COACH_PHONE]) return users[DEMO_COACH_PHONE];
  for (const user of Object.values(users)) {
    if (!user || typeof user !== "object") continue;
    if (String(user.role || "").toLowerCase() === "coach") return user;
    if (String(user.username || "").toLowerCase() === USERNAME) return user;
  }
  return null;
}

function main() {
  const auth = loadAuth();
  const users = auth.users && typeof auth.users === "object" ? auth.users : {};
  auth.users = users;

  let user = findExistingCoach(users);
  const created = !user;
  if (!user) {
    user = {
      phone: DEMO_COACH_PHONE,
      createdAt: new Date().toISOString(),
      role: "coach",
      displayName: DISPLAY_NAME,
      username: USERNAME,
      passwordHash: hashPassword(PASSWORD),
    };
    users[DEMO_COACH_PHONE] = user;
  } else {
    // Re-key onto demo coach phone if an older coach used a different key.
    const prevPhone = String(user.phone || "");
    if (prevPhone && prevPhone !== DEMO_COACH_PHONE && users[prevPhone] === user) {
      delete users[prevPhone];
    }
    user.phone = DEMO_COACH_PHONE;
    user.role = "coach";
    user.username = USERNAME;
    user.displayName = DISPLAY_NAME;
    user.passwordHash = hashPassword(PASSWORD);
    if (!user.createdAt) user.createdAt = new Date().toISOString();
    users[DEMO_COACH_PHONE] = user;
  }

  // Drop colliding username on other accounts (keep four test players intact).
  for (const [phone, other] of Object.entries(users)) {
    if (phone === DEMO_COACH_PHONE || !other || typeof other !== "object") continue;
    if (String(other.username || "").toLowerCase() === USERNAME) {
      delete other.username;
    }
  }

  saveAuth(auth);

  const report = {
    ok: true,
    dryRun: DRY,
    created,
    phone: DEMO_COACH_PHONE,
    username: USERNAME,
    displayName: DISPLAY_NAME,
    role: "coach",
    passwordSet: true,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();
