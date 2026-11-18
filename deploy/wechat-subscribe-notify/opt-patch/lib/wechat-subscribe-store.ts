/**
 * Persist WeChat once-type subscribe accepts / remaining send credits.
 * File-backed (does not extend Postgres user-db kinds auth|intros|scores).
 * Each successful wx.requestSubscribeMessage accept → +1 credit per event.
 * Each successful server send → −1 (best-effort; WeChat remains source of truth).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type SubscribeEvent =
  | "ladder"
  | "invite"
  | "invite_accepted"
  | "score_confirm"
  | "message";

type CreditRow = {
  remaining: number;
  lastAcceptAt?: string;
  lastStatus?: string;
};

type UserCredits = {
  openid?: string;
  phone?: string;
  byEvent: Partial<Record<SubscribeEvent, CreditRow>>;
  updatedAt: string;
};

type Db = {
  users: Record<string, UserCredits>;
};

const empty = (): Db => ({ users: {} });

let cache: Db | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 2500;

function dataDir() {
  return (
    String(process.env.TENNIS_DATA_DIR || "").trim() ||
    path.join(process.cwd(), "data")
  );
}

function filePath() {
  return path.join(dataDir(), "wechat-subscribe.json");
}

function load(): Db {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  try {
    const fp = filePath();
    if (!existsSync(fp)) {
      cache = empty();
    } else {
      const parsed = JSON.parse(readFileSync(fp, "utf8")) as Db;
      cache = {
        users:
          parsed && parsed.users && typeof parsed.users === "object"
            ? parsed.users
            : {},
      };
    }
  } catch {
    cache = empty();
  }
  cacheAt = now;
  return cache;
}

function save(db: Db) {
  cache = db;
  cacheAt = Date.now();
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath(), JSON.stringify(db, null, 2), "utf8");
}

function keyFor(opts: { phone?: string | null; openid?: string | null }) {
  const phone = String(opts.phone || "").trim();
  if (phone) return phone;
  const openid = String(opts.openid || "").trim();
  if (openid) return openid.startsWith("wx_") ? openid : `wx_${openid}`;
  return "";
}

export function recordSubscribeAccepts(input: {
  phone?: string | null;
  openid?: string | null;
  results: Partial<Record<SubscribeEvent, string>>;
}): { ok: true; credits: Partial<Record<SubscribeEvent, number>> } | { error: string } {
  const id = keyFor(input);
  if (!id) return { error: "missing phone/openid" };
  const db = load();
  const now = new Date().toISOString();
  const row: UserCredits = db.users[id] || {
    byEvent: {},
    updatedAt: now,
  };
  if (input.openid) row.openid = String(input.openid).trim();
  if (input.phone) row.phone = String(input.phone).trim();
  const credits: Partial<Record<SubscribeEvent, number>> = {};
  for (const [ev, status] of Object.entries(input.results || {}) as [
    SubscribeEvent,
    string,
  ][]) {
    const st = String(status || "").toLowerCase();
    const prev = row.byEvent[ev] || { remaining: 0 };
    prev.lastStatus = st;
    if (st === "accept") {
      prev.remaining = Math.min(99, (prev.remaining || 0) + 1);
      prev.lastAcceptAt = now;
    }
    row.byEvent[ev] = prev;
    credits[ev] = prev.remaining;
  }
  row.updatedAt = now;
  db.users[id] = row;
  save(db);
  return { ok: true, credits };
}

export function getSubscribeCredits(opts: {
  phone?: string | null;
  openid?: string | null;
}): Partial<Record<SubscribeEvent, number>> {
  const id = keyFor(opts);
  if (!id) return {};
  const row = load().users[id];
  if (!row) return {};
  const out: Partial<Record<SubscribeEvent, number>> = {};
  for (const [ev, credit] of Object.entries(row.byEvent || {}) as [
    SubscribeEvent,
    CreditRow,
  ][]) {
    out[ev] = credit?.remaining || 0;
  }
  return out;
}

export function consumeSubscribeCredit(opts: {
  phone?: string | null;
  openid?: string | null;
  event: SubscribeEvent;
}): { ok: true; remaining: number } | { ok: false; error: string } {
  const id = keyFor(opts);
  if (!id) return { ok: false, error: "missing phone/openid" };
  const db = load();
  const row = db.users[id];
  if (!row) {
    // No local credit record — allow send; WeChat enforces once-type quota (43101).
    return { ok: true, remaining: -1 };
  }
  const credit = row.byEvent[opts.event];
  if (!credit || credit.remaining <= 0) {
    return { ok: true, remaining: 0 };
  }
  credit.remaining = Math.max(0, credit.remaining - 1);
  row.byEvent[opts.event] = credit;
  row.updatedAt = new Date().toISOString();
  db.users[id] = row;
  save(db);
  return { ok: true, remaining: credit.remaining };
}
