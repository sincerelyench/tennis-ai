import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { roleForPhone, type UserRole } from "@/lib/role";
import { userDbLoad, userDbSave } from "@/lib/user-db-sync";

export const sessionCookie = "tennis_session";
export const sessionMaxAge = 60 * 60 * 24 * 30;

/** Known demo / seed labels — never treat as real logged-in display names. */
const BANNED_DISPLAY_NAMES =
  /^(林凯教练|林凯|陈晓|李佳|周宁|王硕|赵琳|孙凯|钱芳|吴迪|陆明|唐悦|何川|沈琪|韩磊|马婷|刘洋|梁浩|陈雨|黄凯|林萱|徐峰|蒋宁|顾然|Alex Chen|Alex Kim|Sam Rivera|Jamie Cole|Yuki Sato|Mei Tan|Coach Lin Kai|111|Help Tip Demo|Restore QA|Signup Demo|ZQ85|zqdemo|probe|webview测试|yanqing|chenyanqing|yanqing Chen|严庆测试|位置测试|小朱|截图账号|截图验证|测试球友甲|测试球员甲|涨球测试|空成绩测试)$/i;

export type AuthUser = {
  phone: string;
  createdAt: string;
  role: UserRole;
  /** Real profile display name set by the logged-in user. Empty = not set. */
  displayName?: string;
  /** Login username (unique, lowercase). Optional for phone/WeChat-only accounts. */
  username?: string;
  /** scrypt salt:hash for username/password login. */
  passwordHash?: string;
  cityId?: string;
  /** Self-level seed for UTR-like ladder (2–5). */
  level?: number;
  /**
   * WeChat ID for 约球 (required in 完善资料).
   * Private: never expose via directory; only reveal to counterpart after match accept.
   */
  wechatId?: string;
  /** WeChat mini-program openid when account was created via wx.login. */
  openid?: string;
  unionid?: string;
};

type Code = { codeHash: string; expiresAt: number };
type Session = { phone: string; createdAt: string; role: UserRole };
type Db = {
  users: Record<string, AuthUser>;
  codes: Record<string, Code>;
  sessions: Record<string, Session>;
};

const empty = (): Db => ({ users: {}, codes: {}, sessions: {} });

let cache: Db | null = null;

function normalize(raw: unknown): Db {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<Db>;
  return {
    users: parsed.users || {},
    codes: parsed.codes || {},
    sessions: parsed.sessions || {},
  };
}

export function invalidateAuthCache() {
  cache = null;
}

function load(): Db {
  if (cache) return cache;
  try {
    cache = normalize(userDbLoad("auth"));
  } catch {
    cache = empty();
  }
  return cache;
}

function save(db: Db) {
  cache = db;
  userDbSave("auth", db);
}

export function normalizePhone(value: string) {
  const phone = value.replace(/\s/g, "").toLowerCase();
  if (phone === "coach" || phone === "coach@" || phone === "coach@tennis") return "13900001390";
  return /^1\d{10}$/.test(phone) ? phone : "";
}

/** Username for password login: 3–32 chars, letters/digits/_/-. Not a bare CN phone. */
export function normalizeUsername(value: string) {
  const name = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!/^[a-z0-9_\-]{3,32}$/.test(name)) return "";
  if (name.startsWith("wx_") || name.startsWith("u_")) return "";
  if (/^1\d{10}$/.test(name)) return "";
  return name;
}

export function usernameAccountKey(username: string) {
  const name = normalizeUsername(username);
  return name ? `u_${name}` : "";
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected || expected.length !== 64) return false;
  const actual = scryptSync(password, salt, 32);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), actual);
  } catch {
    return false;
  }
}

function findUserForPasswordLogin(db: Db, username: string, phoneHint: string): AuthUser | null {
  const name = normalizeUsername(username);
  if (name) {
    for (const user of Object.values(db.users)) {
      if (!user?.phone) continue;
      if (normalizeUsername(user.username || "") === name) return user;
      if (normalizeUsername(user.displayName || "") === name) return user;
      if (user.phone === usernameAccountKey(name)) return user;
    }
  }
  if (phoneHint && db.users[phoneHint]) return db.users[phoneHint];
  return null;
}

/** Sanitize WeChat ID for 约球 (letters/digits/_/- , 3–32). */
export function sanitizeWechatId(raw: string | null | undefined): string {
  const id = String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 32);
  if (!id) return "";
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(id)) return "";
  return id;
}

/**
 * True when signed-in user still needs 约球-required profile fields.
 * Required: display name + WeChat ID. City alone must NOT open the gate.
 * Callers open the dialog only after session hydrate.
 */
export function needsProfileSetup(user: {
  displayName?: string | null;
  cityId?: string | null;
  wechatId?: string | null;
} | null | undefined) {
  return !sanitizeDisplayName(user?.displayName) || !sanitizeWechatId(user?.wechatId);
}

function issueSession(db: Db, user: AuthUser) {
  const token = randomBytes(32).toString("hex");
  db.sessions[token] = {
    phone: user.phone,
    createdAt: new Date().toISOString(),
    role: user.role || roleForPhone(user.phone),
  };
  save(db);
  const displayName = sanitizeDisplayName(user.displayName);
  const cityId = String(user.cityId || "").trim();
  const wechatId = sanitizeWechatId(user.wechatId);
  return {
    token,
    phone: user.phone,
    role: user.role || roleForPhone(user.phone),
    displayName,
    cityId,
    wechatId,
    username: normalizeUsername(user.username || "") || undefined,
    needsProfileSetup: needsProfileSetup({ displayName, wechatId }),
  };
}

/**
 * Create a username/password account. Does not invent a display name or city —
 * callers must collect those in post-signup onboarding.
 */
export function registerWithPassword(usernameRaw: string, passwordRaw: string) {
  const password = String(passwordRaw || "");
  if (password.length < 4 || password.length > 72) {
    return { error: "Password must be 4–72 characters" as const };
  }
  const username = normalizeUsername(usernameRaw);
  if (!username) {
    return { error: "Enter a username (3–32 letters, digits, _ or -)" as const };
  }

  const db = load();
  if (findUserForPasswordLogin(db, username, "")) {
    return { error: "That username is already taken" as const };
  }
  const phone = usernameAccountKey(username);
  if (db.users[phone]) {
    return { error: "That username is already taken" as const };
  }
  const role = roleForPhone(phone);
  const user: AuthUser = {
    phone,
    createdAt: new Date().toISOString(),
    role,
    displayName: "",
    username,
    passwordHash: hashPassword(password),
  };
  db.users[phone] = user;
  return issueSession(db, user);
}

/**
 * Username/password login. New usernames must use register first.
 * Existing phone users can sign in with their displayName/username once a password is set;
 * if they have no password yet, the first successful password attempt sets it (claim).
 */
export function loginWithPassword(usernameRaw: string, passwordRaw: string) {
  const password = String(passwordRaw || "");
  if (password.length < 4 || password.length > 72) {
    return { error: "Password must be 4–72 characters" as const };
  }
  const username = normalizeUsername(usernameRaw);
  const phoneHint = normalizePhone(usernameRaw);
  if (!username && !phoneHint) {
    return { error: "Enter a username (3+ letters/digits) or phone number" as const };
  }

  const db = load();
  let user = findUserForPasswordLogin(db, username || usernameRaw, phoneHint);

  if (!user) {
    if (!username) {
      return { error: "No account for that phone. Use verification code first, or register a username." as const };
    }
    return { error: "No account for that username. Please register first." as const };
  }

  if (!user.passwordHash) {
    // Only the phone number itself may set the first password (avoids name squatting).
    if (!phoneHint || phoneHint !== user.phone) {
      return {
        error: "This account has no password yet. Sign in with phone + code, or use the phone number as the username to set one." as const,
      };
    }
    user.passwordHash = hashPassword(password);
    if (!normalizeUsername(user.username || "") && username) {
      user.username = username;
    }
    db.users[user.phone] = user;
    return issueSession(db, user);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: "Incorrect username or password" as const };
  }
  if (username && !normalizeUsername(user.username || "")) {
    user.username = username;
    db.users[user.phone] = user;
  }
  return issueSession(db, user);
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
  return issueSession(db, db.users[phone]);
}

/** Stable account key for a WeChat openid (stored in the phone field). */
export function wechatAccountKey(openid: string) {
  const id = String(openid || "").trim();
  if (!id) return "";
  return id.startsWith("wx_") ? id : `wx_${id}`;
}

/**
 * Bind or create a 涨球 session from WeChat openid.
 * displayName: prefer an existing real login name; fill from WeChat nick only when empty.
 */
export function loginWithWeChat(opts: {
  openid: string;
  unionid?: string;
  nickName?: string;
  loginMode?: string;
}) {
  const openid = String(opts.openid || "").trim();
  if (!openid || openid.length < 8 || openid.length > 128) {
    return { error: "Invalid WeChat openid" as const };
  }
  const phone = wechatAccountKey(openid);
  const db = load();
  const role: UserRole = db.users[phone]?.role || "player";
  const nick = sanitizeDisplayName(opts.nickName);
  if (!db.users[phone]) {
    db.users[phone] = {
      phone,
      createdAt: new Date().toISOString(),
      role,
      displayName: nick,
      openid,
      unionid: opts.unionid ? String(opts.unionid).trim() : undefined,
    };
  } else {
    db.users[phone].openid = openid;
    if (opts.unionid) db.users[phone].unionid = String(opts.unionid).trim();
    if (!sanitizeDisplayName(db.users[phone].displayName) && nick) {
      db.users[phone].displayName = nick;
    }
    if (!db.users[phone].role) db.users[phone].role = role;
  }
  const issued = issueSession(db, db.users[phone]);
  return {
    ...issued,
    openid,
    loginMode: opts.loginMode || "wechat",
  };
}

export function getUser(phone: string): AuthUser | null {
  const user = load().users[phone];
  return user || null;
}

export function getSession(token: string | undefined | null) {
  if (!token) return null;
  // Route handlers and RSC can hold separate module caches; a login may update
  // Postgres + one cache while the other still has a stale snapshot. On miss,
  // reload once from Postgres (cache miss retry).
  let db = load();
  let session = db.sessions[token];
  if (!session) {
    invalidateAuthCache();
    db = load();
    session = db.sessions[token];
  }
  if (!session) return null;
  const user = db.users[session.phone];
  const role = session.role || user?.role || roleForPhone(session.phone);
  const displayName = sanitizeDisplayName(user?.displayName);
  const cityId = user?.cityId || "";
  const wechatId = sanitizeWechatId(user?.wechatId);
  return {
    phone: session.phone,
    createdAt: session.createdAt,
    role,
    displayName,
    cityId,
    wechatId,
    level: typeof user?.level === "number" ? user.level : null,
    needsProfileSetup: needsProfileSetup({ displayName, wechatId }),
  };
}

export type ProfilePatch = {
  displayName?: string;
  cityId?: string;
  wechatId?: string;
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
  if (patch.wechatId !== undefined) {
    user.wechatId = sanitizeWechatId(patch.wechatId);
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
  const displayName = sanitizeDisplayName(user.displayName);
  const cityId = user.cityId || "";
  const wechatId = sanitizeWechatId(user.wechatId);
  return {
    phone: user.phone,
    role: user.role,
    displayName,
    cityId,
    wechatId,
    level: typeof user.level === "number" ? user.level : null,
    needsProfileSetup: needsProfileSetup({ displayName, wechatId }),
  };
}

/** Own WeChat ID lookup (never put this on public directory rows). */
export function getWechatIdForPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const user = getUser(phone);
  return sanitizeWechatId(user?.wechatId);
}

/** Resolve WeChat ID by phone or display name (for post-accept reveal only). */
export function getWechatIdForPlayer(opts: {
  phone?: string | null;
  displayName?: string | null;
}): string {
  const byPhone = getWechatIdForPhone(opts.phone);
  if (byPhone) return byPhone;
  const name = sanitizeDisplayName(opts.displayName).toLowerCase();
  if (!name) return "";
  const db = load();
  for (const user of Object.values(db.users)) {
    if (sanitizeDisplayName(user.displayName).toLowerCase() === name) {
      return sanitizeWechatId(user.wechatId);
    }
  }
  return "";
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
    // Missing level must NOT default to 3.5 (seed 7.5). Prefer 3.0 → seed 6.5.
    const level =
      typeof user.level === "number" && [2, 2.5, 3, 3.5, 4, 4.5, 5].includes(user.level)
        ? user.level
        : 3;
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
