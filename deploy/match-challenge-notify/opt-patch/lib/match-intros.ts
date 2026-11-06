/**
 * 涨球球友 · 匹配/挑战应战确认 + 微信约球引导
 * awaiting_accept = 已发出邀请，对方未应战；发起方等待确认
 * pending = 对方已应战，进入互相加微信引导
 * replied / cancelled = 已回复或已取消
 */
import { randomBytes } from "crypto";
import { listDirectoryUsers, sanitizeDisplayName } from "@/lib/auth-store";
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
};

type Db = { intros: MatchIntro[] };

export const INTRO_BODY_ZH = "匹配成功，请互相加微信，再自行约定场地和时间。";
export const INTRO_BODY_EN =
  "Match successful. Please add each other on WeChat, then arrange the venue and time yourselves.";

const empty = (): Db => ({ intros: [] });

let cache: Db | null = null;

function load(): Db {
  if (cache) return cache;
  try {
    const parsed = userDbLoad("intros") as Db;
    cache = { intros: Array.isArray(parsed?.intros) ? parsed.intros : [] };
  } catch {
    cache = empty();
  }
  return cache;
}

function save(db: Db) {
  cache = db;
  userDbSave("intros", db);
}

function normName(raw: string) {
  return sanitizeDisplayName(raw).toLowerCase();
}

function resolveUserIdByName(name: string): string | undefined {
  const n = normName(name);
  if (!n) return undefined;
  const users = listDirectoryUsers({ role: "any" });
  const hit = users.find((u) => normName(u.displayName) === n);
  return hit?.phone;
}

function newId() {
  return `mi-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function involved(session: { phone: string; displayName: string }, intro: MatchIntro) {
  const my = normName(session.displayName);
  return (
    intro.fromPhone === session.phone ||
    intro.toPhone === session.phone ||
    (my && (my === normName(intro.fromName) || my === normName(intro.toName)))
  );
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
    toPhone: resolveUserIdByName(toName),
    toName,
    buddyId: String(input.buddyId || toName),
    cityId: input.cityId,
    locale,
    bodyZh: INTRO_BODY_ZH,
    bodyEn: INTRO_BODY_EN,
  };

  const db = load();
  db.intros = db.intros.filter((row) => {
    if (row.status === "cancelled" || row.status === "replied") return true;
    const samePair =
      (normName(row.fromName) === normName(fromName) && normName(row.toName) === normName(toName)) ||
      (normName(row.fromName) === normName(toName) && normName(row.toName) === normName(fromName));
    return !samePair;
  });
  db.intros.unshift(intro);
  save(db);
  return { ok: true, intro };
}

export function acceptIntro(
  id: string,
  session: { phone: string; displayName: string },
): { ok: true; intro: MatchIntro } | { error: string } {
  const db = load();
  const intro = db.intros.find((row) => row.id === id);
  if (!intro) return { error: "Not found" };
  if (intro.status !== "awaiting_accept") return { error: "Not awaiting accept" };
  const iAmTarget =
    intro.toPhone === session.phone || normName(intro.toName) === normName(session.displayName);
  if (!iAmTarget) return { error: "Only the challenged player can accept" };
  intro.status = "pending";
  intro.updatedAt = new Date().toISOString();
  if (!intro.toPhone) intro.toPhone = session.phone;
  save(db);
  return { ok: true, intro };
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
  count: number;
  badge: number;
} {
  const db = load();
  const active: MatchIntro[] = [];
  const inbox: MatchIntro[] = [];
  const mine: MatchIntro[] = [];
  const pendingAccept: MatchIntro[] = [];
  for (const intro of db.intros) {
    if (!involved(session, intro)) continue;
    if (intro.status === "pending" || intro.status === "awaiting_accept") active.push(intro);
    const iAmTarget =
      intro.toPhone === session.phone || normName(intro.toName) === normName(session.displayName);
    if (iAmTarget) inbox.push(intro);
    if (intro.fromPhone === session.phone || normName(intro.fromName) === normName(session.displayName)) {
      mine.push(intro);
    }
    if (iAmTarget && intro.status === "awaiting_accept") pendingAccept.push(intro);
  }
  return {
    active,
    inbox,
    mine,
    pendingAccept,
    count: active.length + inbox.length,
    badge: pendingAccept.length,
  };
}

export function publicIntro(
  intro: MatchIntro,
  locale?: string,
  session?: { phone: string; displayName: string },
) {
  const zh = String(locale || intro.locale || "zh").toLowerCase().startsWith("zh");
  const iAmTarget = session
    ? intro.toPhone === session.phone || normName(intro.toName) === normName(session.displayName)
    : false;
  const iAmFrom = session
    ? intro.fromPhone === session.phone || normName(intro.fromName) === normName(session.displayName)
    : false;
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
  };
}
