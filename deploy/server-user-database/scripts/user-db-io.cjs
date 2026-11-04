#!/usr/bin/env node
/**
 * Load/save 涨球 auth + friends JSON documents in Postgres.
 * Usage:
 *   node user-db-io.cjs load auth|intros|scores
 *   node user-db-io.cjs save auth|intros|scores   < json
 *   node user-db-io.cjs ping
 *   node user-db-io.cjs migrate-from-json [dataDir]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const DATABASE_URL =
  process.env.TENNIS_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://tennis_ai:tennis_ai@127.0.0.1:5432/tennis_ai";

const KINDS = {
  auth: { table: "auth_blob", empty: { users: {}, codes: {}, sessions: {} } },
  intros: { table: "match_intros_blob", empty: { intros: [] } },
  scores: { table: "match_scores_blob", empty: { scores: [] } },
};

async function client() {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

async function ensureSchema(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS auth_blob (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS match_intros_blob (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS match_scores_blob (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      display_name TEXT NOT NULL DEFAULT '',
      city_id TEXT NOT NULL DEFAULT '',
      level DOUBLE PRECISION NULL,
      openid TEXT NULL,
      unionid TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      phone TEXT NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      role TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS codes (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS match_intros (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS match_scores (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function asAuth(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    users: p.users && typeof p.users === "object" ? p.users : {},
    codes: p.codes && typeof p.codes === "object" ? p.codes : {},
    sessions: p.sessions && typeof p.sessions === "object" ? p.sessions : {},
  };
}

function asIntros(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return { intros: Array.isArray(p.intros) ? p.intros : [] };
}

function asScores(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return { scores: Array.isArray(p.scores) ? p.scores : [] };
}

async function loadKind(c, kind) {
  const meta = KINDS[kind];
  const res = await c.query(`SELECT payload FROM ${meta.table} WHERE id = 1`);
  if (!res.rows.length) return meta.empty;
  if (kind === "auth") return asAuth(res.rows[0].payload);
  if (kind === "intros") return asIntros(res.rows[0].payload);
  return asScores(res.rows[0].payload);
}

async function mirrorAuth(c, db) {
  await c.query("BEGIN");
  try {
    await c.query("DELETE FROM codes");
    await c.query("DELETE FROM sessions");
    await c.query("DELETE FROM users");
    for (const user of Object.values(db.users || {})) {
      if (!user || !user.phone) continue;
      await c.query(
        `INSERT INTO users (phone, created_at, role, display_name, city_id, level, openid, unionid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          String(user.phone),
          user.createdAt || new Date().toISOString(),
          user.role || "player",
          user.displayName || "",
          user.cityId || "",
          typeof user.level === "number" ? user.level : null,
          user.openid || null,
          user.unionid || null,
        ],
      );
    }
    for (const [token, session] of Object.entries(db.sessions || {})) {
      if (!session || !session.phone) continue;
      if (!(db.users || {})[session.phone]) continue;
      await c.query(
        `INSERT INTO sessions (token, phone, created_at, role) VALUES ($1,$2,$3,$4)
         ON CONFLICT (token) DO UPDATE SET phone = EXCLUDED.phone, role = EXCLUDED.role, updated_at = NOW()`,
        [token, session.phone, session.createdAt || new Date().toISOString(), session.role || "player"],
      );
    }
    for (const [phone, code] of Object.entries(db.codes || {})) {
      if (!code) continue;
      await c.query(
        `INSERT INTO codes (phone, code_hash, expires_at) VALUES ($1,$2,$3)
         ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
        [phone, code.codeHash, Number(code.expiresAt) || 0],
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  }
}

async function mirrorIntros(c, db) {
  await c.query("BEGIN");
  try {
    await c.query("DELETE FROM match_intros");
    for (const intro of db.intros || []) {
      if (!intro || !intro.id) continue;
      await c.query(
        `INSERT INTO match_intros (id, status, payload, created_at, updated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [
          intro.id,
          intro.status || "pending",
          JSON.stringify(intro),
          intro.createdAt || new Date().toISOString(),
          intro.updatedAt || intro.createdAt || new Date().toISOString(),
        ],
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  }
}

async function mirrorScores(c, db) {
  await c.query("BEGIN");
  try {
    await c.query("DELETE FROM match_scores");
    for (const score of db.scores || []) {
      if (!score || !score.id) continue;
      await c.query(
        `INSERT INTO match_scores (id, status, payload, created_at, updated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [
          score.id,
          score.status || "pending",
          JSON.stringify(score),
          score.createdAt || new Date().toISOString(),
          score.confirmedAt || score.rejectedAt || score.createdAt || new Date().toISOString(),
        ],
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  }
}

async function saveKind(c, kind, payload) {
  const meta = KINDS[kind];
  let data = meta.empty;
  if (kind === "auth") data = asAuth(payload);
  else if (kind === "intros") data = asIntros(payload);
  else data = asScores(payload);

  await c.query(
    `INSERT INTO ${meta.table} (id, payload, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [JSON.stringify(data)],
  );

  if (kind === "auth") await mirrorAuth(c, data);
  if (kind === "intros") await mirrorIntros(c, data);
  if (kind === "scores") await mirrorScores(c, data);
}

async function migrateFromJson(c, dataDir) {
  const dir = dataDir || path.join(process.cwd(), ".data");
  const files = {
    auth: path.join(dir, "auth.json"),
    intros: path.join(dir, "match-intros.json"),
    scores: path.join(dir, "match-scores.json"),
  };
  const report = { dir, migrated: {}, skipped: {} };

  for (const [kind, file] of Object.entries(files)) {
    const existing = await loadKind(c, kind);
    const hasRows =
      kind === "auth"
        ? Object.keys(existing.users || {}).length > 0
        : kind === "intros"
          ? (existing.intros || []).length > 0
          : (existing.scores || []).length > 0;
    if (hasRows) {
      report.skipped[kind] = "already-populated";
      continue;
    }
    if (!fs.existsSync(file)) {
      report.skipped[kind] = "missing-json";
      await saveKind(c, kind, KINDS[kind].empty);
      continue;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    await saveKind(c, kind, parsed);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bak = `${file}.pre-pg-${stamp}.bak`;
    fs.copyFileSync(file, bak);
    report.migrated[kind] = { from: file, backup: bak };
  }
  return report;
}

async function ping(c) {
  const users = await c.query("SELECT COUNT(*)::int AS n FROM users");
  const sessions = await c.query("SELECT COUNT(*)::int AS n FROM sessions");
  const scores = await c.query("SELECT COUNT(*)::int AS n FROM match_scores");
  const intros = await c.query("SELECT COUNT(*)::int AS n FROM match_intros");
  return {
    ok: true,
    users: users.rows[0].n,
    sessions: sessions.rows[0].n,
    scores: scores.rows[0].n,
    intros: intros.rows[0].n,
  };
}

async function main() {
  const [cmd, kind, extra] = process.argv.slice(2);
  if (!cmd) {
    console.error("usage: load|save|ping|migrate-from-json");
    process.exit(2);
  }
  const c = await client();
  try {
    await ensureSchema(c);
    if (cmd === "ping") {
      process.stdout.write(JSON.stringify(await ping(c)));
      return;
    }
    if (cmd === "migrate-from-json") {
      process.stdout.write(JSON.stringify(await migrateFromJson(c, kind || extra), null, 2));
      return;
    }
    if (!KINDS[kind]) {
      console.error("kind must be auth|intros|scores");
      process.exit(2);
    }
    if (cmd === "load") {
      process.stdout.write(JSON.stringify(await loadKind(c, kind)));
      return;
    }
    if (cmd === "save") {
      const raw = fs.readFileSync(0, "utf8");
      const payload = raw ? JSON.parse(raw) : KINDS[kind].empty;
      await saveKind(c, kind, payload);
      process.stdout.write(JSON.stringify({ ok: true }));
      return;
    }
    console.error("unknown command");
    process.exit(2);
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
