/**
 * 涨球球友 · 匹配/挑战应战确认 + 微信约球引导
 * awaiting_accept = 已发出邀请，对方未应战；发起方等待确认
 * pending = 对方已应战，进入互相加微信引导 + 约球成功/录入比分引导
 * replied / cancelled = 已回复或已取消
 *
 * 对方应战后：发起方收到通知中心未读（fromNotify），约球页展示成功态并引导录入比分。
 */
import { randomBytes } from "crypto";
import {
  getWechatIdForPlayer,
  listDirectoryUsers,
  sanitizeDisplayName,
} from "@/lib/auth-store";
import { findConfirmedScoreBetween, publicScore } from "@/lib/match-scores";
import { userDbLoad, userDbSave } from "@/lib/user-db-sync";

export type IntroKind = "match" | "challenge";
export type IntroStatus = "awaiting_accept" | "pending" | "replied" | "cancelled";

export type MatchIntro = {
  id: string;
  kind: IntroKind;
  status: IntroStatus;
  createdAt: string;
  updatedAt: string;
  fromPhone: string;
  fromName: string;
  toPhone?: string;
  toName: string;
  buddyId: string;
  cityId?: string;
  locale: "zh" | "en";
  bodyZh: string;
  bodyEn: string;
  repliedAt?: string;
  cancelledAt?: string;
  cancelledByPhone?: string;
  /** 对方应战时间；发起方据此收到「约球成功」通知 */
  acceptedAt?: string;
  /** 发起方是否仍有「对方已应战」未读通知 */
  fromNotify?: boolean;
};

type Db = { intros: MatchIntro[] };

export const INTRO_BODY_ZH = "匹配成功，请互相加微信，再自行约定场地和时间。";
export const INTRO_BODY_EN =
  "Match successful. Please add each other on WeChat, then arrange the venue and time yourselves.";

const empty = (): Db => ({ intros: [] });

let cache: Db | null = null;
let cacheAt = 0;
/** Short TTL so dual blob/table writers / multi-process restarts cannot hide rows forever. */
const CACHE_TTL_MS = 2500;

function load(): Db {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  try {
    const parsed = userDbLoad("intros") as Db;
    cache = { intros: Array.isArray(parsed?.intros) ? parsed.intros : [] };
  } catch {
    cache = empty();
  }
  cacheAt = now;
  return cache;
}

function save(db: Db) {
  cache = db;
  cacheAt = Date.now();
  userDbSave("intros", db);
}

function normName(raw: string) {
  return sanitizeDisplayName(raw).toLowerCase();
}

/**
 * Resolve displayName → user id.
 * When ladder/challenge passes buddyId, prefer that exact account (avoids Shanghai twin
 * 13900000003 stealing Wuxi 18662147197 for 「陈燕青」). Optional cityId prefers same city.
 */
function resolveUserIdByName(
  name: string,
  preferredId?: string,
  cityId?: string,
): string | undefined {
  const n = normName(name);
  if (!n) return undefined;
  const directory = listDirectoryUsers({ role: "any" });
  const preferred = String(preferredId || "").trim();
  if (preferred) {
    const byId = directory.find((u) => u.phone === preferred);
    if (byId && (!n || normName(byId.displayName) === n || !sanitizeDisplayName(byId.displayName))) {
      return byId.phone;
    }
    // buddyId may be a valid phone even if displayName briefly empty
    if (byId) return byId.phone;
  }
  const users = directory.filter((u) => normName(u.displayName) === n);
  if (users.length === 0) return preferred || undefined;
  const city = String(cityId || "").trim();
  const pool = city ? users.filter((u) => String(u.cityId || "").trim() === city) : users;
  const ranked = pool.length > 0 ? pool : users;
  // Prefer real CN mobile accounts over synthetic u_* ids when names collide.
  const phoneLike = ranked.find((u) => /^1\d{10}$/.test(String(u.phone || "")));
  return (phoneLike || ranked[0])?.phone;
}

function newId() {
  return `mi-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function currentDisplayNameForPhone(phone?: string): string {
  const id = String(phone || "").trim();
  if (!id) return "";
  const hit = listDirectoryUsers({ role: "any" }).find((u) => u.phone === id);
  return sanitizeDisplayName(hit?.displayName || "");
}

/** Phones that share the same WeChat id as the session (same person, multi-login). */
function linkedPhonesForSession(session: { phone: string; displayName: string }): Set<string> {
  const out = new Set<string>([String(session.phone || "").trim()].filter(Boolean));
  const wx = getWechatIdForPlayer({ phone: session.phone, displayName: session.displayName });
  if (!wx) return out;
  for (const u of listDirectoryUsers({ role: "any" })) {
    const other = getWechatIdForPlayer({ phone: u.phone, displayName: u.displayName || "" });
    if (other && other === wx) out.add(u.phone);
  }
  return out;
}

/**
 * Own one side of an intro without inventing rows:
 * - phone / wechat-linked phone match, or
 * - target-side ladder buddyId (challenge/match from 本地排行 always stores opponent id here), or
 * - historical displayName match when that side's phone no longer claims the name
 *   (orphan/ghost accounts after trim/fix-db cleared names, e.g. u_111 → 袁啸).
 * Active accounts that still claim the same displayName do NOT steal each other's phone-bound rows
 * — except when buddyId explicitly points at this session (mis-bound twin toPhone).
 */
function ownsIntroSide(
  session: { phone: string; displayName: string },
  intro: MatchIntro,
  side: "from" | "to",
): boolean {
  const phone = side === "from" ? intro.fromPhone : intro.toPhone;
  const name = side === "from" ? intro.fromName : intro.toName;
  const linked = linkedPhonesForSession(session);
  if (phone && linked.has(phone)) return true;
  // Ladder challenges set buddyId = target player id; honor it even if toPhone was
  // wrongly resolved to a same-name twin (e.g. 陈燕青 shanghai 13900000003).
  if (side === "to") {
    const buddy = String(intro.buddyId || "").trim();
    if (buddy && linked.has(buddy)) return true;
  }
  const my = normName(session.displayName);
  if (!my || my !== normName(name)) return false;
  if (!phone) return true;
  const ownerName = normName(currentDisplayNameForPhone(phone));
  // Orphan: intro still says my name, but that phone id no longer holds it.
  return !ownerName || ownerName !== my;
}

function involved(session: { phone: string; displayName: string }, intro: MatchIntro) {
  return ownsIntroSide(session, intro, "from") || ownsIntroSide(session, intro, "to");
}

function iAmFromSession(session: { phone: string; displayName: string }, intro: MatchIntro) {
  return ownsIntroSide(session, intro, "from");
}

function iAmTargetSession(session: { phone: string; displayName: string }, intro: MatchIntro) {
  return ownsIntroSide(session, intro, "to");
}

export function createMatchIntro(input: {
  fromPhone: string;
  fromName: string;
  toName: string;
  buddyId: string;
  cityId?: string;
  locale?: string;
  kind?: IntroKind;
  openIntro?: boolean;
}): { ok: true; intro: MatchIntro } | { error: string } {
  const fromName = sanitizeDisplayName(input.fromName);
  const toName = sanitizeDisplayName(input.toName);
  if (!fromName) return { error: "Set your display name first" };
  if (!getWechatIdForPlayer({ phone: input.fromPhone, displayName: fromName })) {
    return { error: "Add your WeChat ID in profile first" };
  }
  if (!toName) return { error: "Pick a player" };
  if (normName(fromName) === normName(toName)) return { error: "Cannot match yourself" };

  const kind: IntroKind = input.kind || "match";
  // 匹配与挑战均先进入应战确认；仅显式 openIntro=true 时跳过（兼容旧客户端）
  const openIntro = input.openIntro === true;
  const locale: "zh" | "en" = String(input.locale || "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
  const now = new Date().toISOString();
  const intro: MatchIntro = {
    id: newId(),
    kind,
    status: openIntro ? "pending" : "awaiting_accept",
    createdAt: now,
    updatedAt: now,
    fromPhone: input.fromPhone,
    fromName,
    toPhone: resolveUserIdByName(toName, String(input.buddyId || ""), input.cityId),
    toName,
    buddyId: String(input.buddyId || toName),
    cityId: input.cityId,
    locale,
    bodyZh: INTRO_BODY_ZH,
    bodyEn: INTRO_BODY_EN,
  };

  // 直开微信引导（openIntro）也视为约球成功记录
  if (openIntro) {
    intro.acceptedAt = now;
  }

  const db = load();
  const next: MatchIntro[] = [];
  for (const row of db.intros) {
    if (row.status === "cancelled" || row.status === "replied") {
      next.push(row);
      continue;
    }
    const samePair =
      (normName(row.fromName) === normName(fromName) && normName(row.toName) === normName(toName)) ||
      (normName(row.fromName) === normName(toName) && normName(row.toName) === normName(fromName));
    if (!samePair) {
      next.push(row);
      continue;
    }
    // 同对手再约：已应战的旧记录归档为 replied，保留在「约球成功」列表；未应战的替换掉
    if (row.status === "pending" || row.acceptedAt) {
      next.push({
        ...row,
        status: "replied",
        repliedAt: row.repliedAt || now,
        updatedAt: now,
        fromNotify: false,
      });
    }
  }
  db.intros = next;
  db.intros.unshift(intro);
  save(db);
  return { ok: true, intro };
}

/** 已应战 / 约球成功（含归档后的 replied）；须有 acceptedAt，或仍处 pending 应战成功态。 */
export function isSuccessfulIntro(intro: MatchIntro): boolean {
  if (intro.status === "cancelled" || intro.status === "awaiting_accept") return false;
  if (intro.acceptedAt) return true;
  return intro.status === "pending";
}

export function acceptIntro(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; intro: MatchIntro } | { error: string } {
  const db = load();
  const intro = db.intros.find((row) => row.id === id);
  if (!intro) return { error: "Not found" };
  if (intro.status !== "awaiting_accept") return { error: "Not awaiting accept" };
  const iAmTarget = iAmTargetSession(session, intro);
  if (!iAmTarget) return { error: "Only the challenged player can accept" };
  const now = new Date().toISOString();
  intro.status = "pending";
  intro.acceptedAt = now;
  intro.fromNotify = true;
  intro.updatedAt = now;
  // Bind / repair target phone: empty, or twin mis-bind when buddyId is this session.
  const buddy = String(intro.buddyId || "").trim();
  if (!intro.toPhone || (buddy && buddy === session.phone && intro.toPhone !== session.phone)) {
    intro.toPhone = session.phone;
  }
  save(db);
  return { ok: true, intro };
}

/** 发起方查看/确认「对方已应战」通知后清除未读 */
export function ackAcceptedIntro(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; intro: MatchIntro } | { error: string } {
  const db = load();
  const intro = db.intros.find((row) => row.id === id);
  if (!intro) return { error: "Not found" };
  const iAmFrom =
    intro.fromPhone === session.phone || normName(intro.fromName) === normName(session.displayName);
  if (!iAmFrom) return { error: "Only the initiator can acknowledge" };
  if (!intro.fromNotify) return { ok: true, intro };
  intro.fromNotify = false;
  intro.updatedAt = new Date().toISOString();
  save(db);
  return { ok: true, intro };
}

export function ackAllAcceptedForUser(session: { phone: string; displayName: string }): number {
  const db = load();
  let n = 0;
  const now = new Date().toISOString();
  for (const intro of db.intros) {
    if (!intro.fromNotify) continue;
    const iAmFrom =
      intro.fromPhone === session.phone || normName(intro.fromName) === normName(session.displayName);
    if (!iAmFrom) continue;
    intro.fromNotify = false;
    intro.updatedAt = now;
    n += 1;
  }
  if (n) save(db);
  return n;
}

export function replyIntro(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; intro: MatchIntro } | { error: string } {
  const db = load();
  const intro = db.intros.find((row) => row.id === id);
  if (!intro) return { error: "Not found" };
  if (intro.status !== "pending") return { error: "Not pending" };
  if (!involved(session, intro)) return { error: "Not your thread" };
  intro.status = "replied";
  intro.repliedAt = new Date().toISOString();
  intro.updatedAt = intro.repliedAt;
  save(db);
  return { ok: true, intro };
}

export function cancelIntro(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; intro: MatchIntro } | { error: string } {
  const db = load();
  const intro = db.intros.find((row) => row.id === id);
  if (!intro) return { error: "Not found" };
  if (intro.status !== "pending" && intro.status !== "awaiting_accept") {
    return { error: "Nothing to cancel" };
  }
  if (!involved(session, intro)) return { error: "Not your thread" };
  intro.status = "cancelled";
  intro.cancelledAt = new Date().toISOString();
  intro.cancelledByPhone = session.phone;
  intro.updatedAt = intro.cancelledAt;
  save(db);
  return { ok: true, intro };
}

export function listIntrosForUser(session: { phone: string; displayName: string }): {
  active: MatchIntro[];
  inbox: MatchIntro[];
  mine: MatchIntro[];
  pendingAccept: MatchIntro[];
  /** 我发出、对方尚未应战（未进约球成功） */
  sentPending: MatchIntro[];
  acceptedNotify: MatchIntro[];
  /** 与当前用户相关的全部约球成功记录（应战成功 / 已归档） */
  success: MatchIntro[];
  count: number;
  badge: number;
} {
  const db = load();
  const active: MatchIntro[] = [];
  const inbox: MatchIntro[] = [];
  const mine: MatchIntro[] = [];
  const pendingAccept: MatchIntro[] = [];
  const sentPending: MatchIntro[] = [];
  const acceptedNotify: MatchIntro[] = [];
  const success: MatchIntro[] = [];
  for (const intro of db.intros) {
    if (!involved(session, intro)) continue;
    if (intro.status === "pending" || intro.status === "awaiting_accept") active.push(intro);
    const iAmTarget = iAmTargetSession(session, intro);
    const iAmFrom = iAmFromSession(session, intro);
    // inbox：仅未应战的新邀请；约球成功（pending/replied）走 success，不再挂邀请
    if (iAmTarget && intro.status === "awaiting_accept") inbox.push(intro);
    if (iAmFrom) mine.push(intro);
    if (iAmTarget && intro.status === "awaiting_accept") pendingAccept.push(intro);
    // 发出方等待应战：进「我发出的邀请」；应战后离开此列表进入 success
    if (iAmFrom && intro.status === "awaiting_accept") sentPending.push(intro);
    // 发起方：对方已应战且未读 → 通知中心红点
    if (iAmFrom && intro.fromNotify && (intro.status === "pending" || Boolean(intro.acceptedAt))) {
      acceptedNotify.push(intro);
    }
    if (isSuccessfulIntro(intro)) success.push(intro);
  }
  // 严格跟库：每条真实成功 intro 一行，不做按对手折叠。
  success.sort((a, b) => {
    const ta = Date.parse(a.acceptedAt || a.updatedAt || a.createdAt) || 0;
    const tb = Date.parse(b.acceptedAt || b.updatedAt || b.createdAt) || 0;
    return tb - ta;
  });
  sentPending.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt) || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt) || 0;
    return tb - ta;
  });
  return {
    active,
    inbox,
    mine,
    pendingAccept,
    sentPending,
    acceptedNotify,
    success,
    count: active.length + inbox.length,
    // 邀请方待应战 + 发起方「对方已应战」未读
    badge: pendingAccept.length + acceptedNotify.length,
  };
}

export function publicIntro(
  intro: MatchIntro,
  locale?: string,
  session?: { phone: string; displayName: string },
) {
  const zh = String(locale || intro.locale || "zh").toLowerCase().startsWith("zh");
  const iAmTarget = session ? iAmTargetSession(session, intro) : false;
  const iAmFrom = session ? iAmFromSession(session, intro) : false;
  const acceptedUnread = Boolean(iAmFrom && intro.fromNotify);
  const matchSuccess = isSuccessfulIntro(intro);
  // Privacy: reveal counterpart WeChat ONLY after accept / 约球成功.
  // Prefer phone lookup so a duplicate displayName cannot leak another account's WeChat.
  let opponentWechat: string | null = null;
  if (matchSuccess && session) {
    if (iAmFrom) {
      opponentWechat =
        getWechatIdForPlayer({ phone: intro.toPhone, displayName: intro.toName }) || null;
    } else if (iAmTarget) {
      opponentWechat =
        getWechatIdForPlayer({ phone: intro.fromPhone, displayName: intro.fromName }) || null;
    }
  }
  const opponentName = iAmFrom ? intro.toName : intro.fromName;
  // Attach confirmed score between the two named players (if any) so 约球成功
  // can show 比分 even when the client score list is briefly empty.
  const hit = findConfirmedScoreBetween(intro.fromName, intro.toName);
  const linkedScore = hit ? publicScore(hit) : null;
  return {
    id: intro.id,
    kind: intro.kind,
    status: intro.status,
    createdAt: intro.createdAt,
    updatedAt: intro.updatedAt,
    fromName: intro.fromName,
    toName: intro.toName,
    buddyId: intro.buddyId,
    cityId: intro.cityId || null,
    body: zh ? intro.bodyZh : intro.bodyEn,
    bodyZh: intro.bodyZh,
    bodyEn: intro.bodyEn,
    canCancel: intro.status === "pending" || intro.status === "awaiting_accept",
    needsAccept: intro.status === "awaiting_accept" && (!session || iAmTarget),
    iAmTarget,
    iAmFrom,
    awaitingOther: intro.status === "awaiting_accept" && iAmFrom && !iAmTarget,
    acceptedAt: intro.acceptedAt || null,
    /** 约球已成功（对方已应战 / 已进入微信引导 / 已归档） */
    matchSuccess,
    acceptedUnread,
    fromNotify: acceptedUnread,
    /** Always the counterpart's display name — never WeChat id. */
    opponentName,
    /** Present only after accept; never on awaiting_accept. */
    opponentWechat,
    linkedScore,
  };
}
