import { createHash, randomBytes, randomInt } from "crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { roleForPhone, type UserRole } from "@/lib/role";

export const sessionCookie = "tennis_session";
export const sessionMaxAge = 60 * 60 * 24 * 30;

/** Known demo / seed labels — never treat as real logged-in display names. */
const BANNED_DISPLAY_NAMES =
  /^(林凯教练|林凯|陈晓|李佳|周宁|王硕|赵琳|孙凯|钱芳|吴迪|陆明|唐悦|何川|沈琪|韩磊|马婷|刘洋|梁浩|陈雨|黄凯|林萱|徐峰|蒋宁|顾然|Alex Chen|Alex Kim|Sam Rivera|Jamie Cole|Yuki Sato|Mei Tan|Coach Lin Kai)$/i;

export type AuthUser = {
  phone: string;
  createdAt: string;
  role: UserRole;
  /** Real profile display name set by the logged-in user. Empty = not set. */
  displayName?: string;
  cityId?: string;
  /** Self-level seed for UTR-like ladder (2–5). */
  level?: number;
};

type Code = { codeHash: string; expiresAt: number };
type Session = { phone: string; createdAt: string; role: UserRole };
type Db = {
  users: Record<string, AuthUser>;
  codes: Record<string, Code>;
  sessions: Record<string, Session>;
};

const empty = (): Db => ({ users: {}, codes: {}, sessions: {} });

function dir() {
  return process.env.TENNIS_DATA_DIR || path.join(process.cwd(), ".data");
}

function file() {
  return path.join(dir(), "auth.json");
}

function load(): Db {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Db;
    return {
      users: parsed.users || {},
      codes: parsed.codes || {},
      sessions: parsed.sessions || {},
    };
  } catch {
    return empty();
  }
}

function save(db: Db) {
  mkdirSync(dir(), { recursive: true });
  const target = file();
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, target);
}

export function normalizePhone(value: string) {
  const phone = value.replace(/\s/g, "").toLowerCase();
  if (phone === "coach" || phone === "coach@" || phone === "coach@tennis") return "13900001390";
  return /^1\d{10}$/.test(phone) ? phone : "";
}

/** Sanitize a user-facing display name. Returns "" if empty or a known fake demo label. */
export function sanitizeDisplayName(raw: string | null | undefined): string {
  const name = String(raw || "").trim().slice(0, 40);
  if (!name) return "";
  if (BANNED_DISPLAY_NAMES.test(name)) return "";
  if (/poppy|东东|dongdong|掌球/i.test(name)) return "";
  return name;
}

function hashCode(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export function issueCode(phone: string) {
  const code = randomInt(0, 10000).toString().padStart(4, "0");
  const db = load();
  db.codes[phone] = {
    codeHash: hashCode(phone, code),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  save(db);
  return code;
}

export function loginWithCode(phone: string, code: string) {
  const db = load();
  const pending = db.codes[phone];
  if (!pending || pending.expiresAt < Date.now()) {
    return { error: "That code expired. Get a new one." as const };
  }
  if (pending.codeHash !== hashCode(phone, code.trim())) {
    return { error: "That verification code is incorrect" as const };
  }
  delete db.codes[phone];
  const role = db.users[phone]?.role || roleForPhone(phone);
  if (!db.users[phone]) {
    db.users[phone] = { phone, createdAt: new Date().toISOString(), role, displayName: "" };
  } else if (!db.users[phone].role) {
    db.users[phone].role = role;
  }
  const token = randomBytes(32).toString("hex");
  db.sessions[token] = { phone, createdAt: new Date().toISOString(), role: db.users[phone].role };
  save(db);
  const displayName = sanitizeDisplayName(db.users[phone].displayName);
  return { token, phone, role: db.users[phone].role, displayName };
}

export function getUser(phone: string): AuthUser | null {
  const user = load().users[phone];
  return user || null;
}

export function getSession(token: string | undefined | null) {
  if (!token) return null;
  const db = load();
  const session = db.sessions[token];
  if (!session) return null;
  const user = db.users[session.phone];
  const role = session.role || user?.role || roleForPhone(session.phone);
  return {
    phone: session.phone,
    createdAt: session.createdAt,
    role,
    displayName: sanitizeDisplayName(user?.displayName),
    cityId: user?.cityId || "",
    level: typeof user?.level === "number" ? user.level : null,
  };
}

export type ProfilePatch = {
  displayName?: string;
  cityId?: string;
  level?: number | null;
};

export function updateProfile(phone: string, patch: ProfilePatch) {
  const db = load();
  const user = db.users[phone];
  if (!user) return { error: "Please sign in" as const };
  if (patch.displayName !== undefined) {
    user.displayName = sanitizeDisplayName(patch.displayName);
  }
  if (patch.cityId !== undefined) {
    const city = String(patch.cityId || "").trim().slice(0, 40);
    user.cityId = city;
  }
  if (patch.level !== undefined) {
    const n = Number(patch.level);
    if (patch.level === null || !Number.isFinite(n)) {
      delete user.level;
    } else {
      const allowed = [2, 2.5, 3, 3.5, 4, 4.5, 5];
      if (allowed.includes(n)) user.level = n;
    }
  }
  db.users[phone] = user;
  save(db);
  return {
    phone: user.phone,
    role: user.role,
    displayName: sanitizeDisplayName(user.displayName),
    cityId: user.cityId || "",
    level: typeof user.level === "number" ? user.level : null,
  };
}

export type DirectoryUser = {
  id: string;
  phone: string;
  displayName: string;
  role: UserRole;
  cityId: string;
  level: number;
};

/**
 * Logged-in users who have a real displayName.
 * No displayName → omitted (callers show count 0 / empty list).
 * Never invents demo names.
 */
export function listDirectoryUsers(opts?: {
  role?: UserRole | "any";
  cityId?: string | null;
  excludePhone?: string | null;
}): DirectoryUser[] {
  const db = load();
  const roleFilter = opts?.role || "any";
  const cityFilter = (opts?.cityId || "").trim();
  const exclude = (opts?.excludePhone || "").trim();
  const out: DirectoryUser[] = [];
  for (const user of Object.values(db.users)) {
    if (!user?.phone) continue;
    if (exclude && user.phone === exclude) continue;
    const displayName = sanitizeDisplayName(user.displayName);
    if (!displayName) continue;
    const role = user.role || roleForPhone(user.phone);
    if (roleFilter !== "any" && role !== roleFilter) continue;
    const cityId = String(user.cityId || "").trim();
    if (cityFilter && cityId !== cityFilter) continue;
    const level =
      typeof user.level === "number" && [2, 2.5, 3, 3.5, 4, 4.5, 5].includes(user.level)
        ? user.level
        : 3.5;
    out.push({
      id: user.phone,
      phone: user.phone,
      displayName,
      role,
      cityId,
      level,
    });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, "zh"));
  return out;
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  const db = load();
  if (!db.sessions[token]) return;
  delete db.sessions[token];
  save(db);
}

export function safeNext(value: string | undefined | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/";
  }
  return value;
}
