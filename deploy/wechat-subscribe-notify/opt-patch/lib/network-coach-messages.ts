/**
 * Server-persisted network coach ↔ player 留言板 (ZQ-150 event 5).
 * Replaces browser-only localStorage as the source of truth for push;
 * client may still mirror to tennis-network-coach-messages-v1 for offline UX.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  getUser,
  listDirectoryUsers,
  sanitizeDisplayName,
} from "@/lib/auth-store";
import { notifySubscribe } from "@/lib/wechat-subscribe";

export type BoardFrom = "student" | "coach";

export type NetworkCoachMessage = {
  id: string;
  coachId: string;
  text: string;
  at: string;
  from: BoardFrom;
  fromPhone?: string;
  fromName?: string;
  status?: "pending" | "replied";
  kind?: "video-guidance" | "note" | "guidance";
  jobId?: string;
  studentKey?: string;
  studentLabel?: string;
  /** Resolved recipient phone when known (for openid lookup). */
  toPhone?: string;
};

type Db = {
  /** coachId → messages (newest last; capped). */
  byCoach: Record<string, NetworkCoachMessage[]>;
  /** coachId → AuthUser.phone of the coach who last posted (owner hint). */
  coachOwners: Record<string, string>;
  updatedAt: string;
};

const MAX_PER_COACH = 60;

const empty = (): Db => ({ byCoach: {}, coachOwners: {}, updatedAt: new Date().toISOString() });

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
  return path.join(dataDir(), "network-coach-messages.json");
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
        byCoach:
          parsed?.byCoach && typeof parsed.byCoach === "object" ? parsed.byCoach : {},
        coachOwners:
          parsed?.coachOwners && typeof parsed.coachOwners === "object"
            ? parsed.coachOwners
            : {},
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    cache = empty();
  }
  cacheAt = now;
  return cache;
}

function save(db: Db) {
  db.updatedAt = new Date().toISOString();
  cache = db;
  cacheAt = Date.now();
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath(), JSON.stringify(db, null, 2), "utf8");
}

function newId() {
  return `ncm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function looksLikePhone(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (s.startsWith("wx_") && s.length > 6) return true;
  if (/^\d{11}$/.test(s)) return true;
  if (/^1\d{10}$/.test(s)) return true;
  return false;
}

/** Resolve a soft studentKey / label to an AuthUser phone when possible. */
export function resolveStudentPhone(opts: {
  studentKey?: string | null;
  studentLabel?: string | null;
}): string | null {
  const key = String(opts.studentKey || "").trim();
  if (key && looksLikePhone(key)) return key;
  if (key) {
    const byPhone = getUser(key);
    if (byPhone) return byPhone.phone;
  }
  const label = sanitizeDisplayName(opts.studentLabel || key);
  if (!label || label === "default" || label === "学员" || label === "Student") {
    return looksLikePhone(key) ? key : null;
  }
  const hits = listDirectoryUsers({ role: "any" }).filter(
    (u) => sanitizeDisplayName(u.displayName || "") === label,
  );
  if (hits.length === 1) return hits[0].phone;
  for (const h of hits) {
    if (getUser(h.phone)?.openid) return h.phone;
  }
  return hits[0]?.phone || null;
}

/** Resolve coachId → coach account phone (owner map, then directory role=coach). */
export function resolveCoachPhone(coachId: string): string | null {
  const id = String(coachId || "").trim();
  if (!id) return null;
  const db = load();
  if (db.coachOwners[id]) return db.coachOwners[id];
  if (looksLikePhone(id)) return id;
  const coaches = listDirectoryUsers({ role: "coach" });
  // Prefer exact displayName / username match against coachId slug
  for (const c of coaches) {
    const name = sanitizeDisplayName(c.displayName || "");
    if (name && (name === id || name.toLowerCase() === id.toLowerCase())) {
      return c.phone;
    }
  }
  // Single demo coach account fallback when only one coach exists
  if (coaches.length === 1) return coaches[0].phone;
  return null;
}

export function listMessagesForCoach(coachId: string): NetworkCoachMessage[] {
  const id = String(coachId || "").trim();
  if (!id) return [];
  const list = load().byCoach[id];
  return Array.isArray(list) ? list.slice() : [];
}

export function listMessagesForStudent(opts: {
  coachId: string;
  studentPhone?: string | null;
  studentKey?: string | null;
}): NetworkCoachMessage[] {
  const all = listMessagesForCoach(opts.coachId);
  const phone = String(opts.studentPhone || "").trim();
  const key = String(opts.studentKey || phone || "").trim();
  if (!phone && !key) return all;
  return all.filter((m) => {
    if (!m.studentKey && !m.toPhone && m.from === "coach") return true;
    if (phone && (m.studentKey === phone || m.toPhone === phone || m.fromPhone === phone)) {
      return true;
    }
    if (key && (m.studentKey === key || m.fromPhone === key)) return true;
    return false;
  });
}

export function postNetworkCoachMessage(input: {
  coachId: string;
  text: string;
  from: BoardFrom;
  fromPhone: string;
  fromName?: string;
  kind?: NetworkCoachMessage["kind"];
  jobId?: string;
  studentKey?: string;
  studentLabel?: string;
}): { ok: true; message: NetworkCoachMessage } | { error: string } {
  const coachId = String(input.coachId || "").trim();
  const text = String(input.text || "").trim();
  if (!coachId) return { error: "Missing coachId" };
  if (!text) return { error: "Empty message" };
  if (text.length > 2000) return { error: "Message too long" };

  const db = load();
  const from: BoardFrom = input.from === "coach" ? "coach" : "student";
  const fromPhone = String(input.fromPhone || "").trim();
  const studentKey = String(input.studentKey || (from === "student" ? fromPhone : "") || "").trim();
  const studentLabel = String(input.studentLabel || "").trim();

  if (from === "coach" && fromPhone) {
    db.coachOwners[coachId] = fromPhone;
  }

  let toPhone: string | undefined;
  if (from === "coach") {
    toPhone = resolveStudentPhone({ studentKey, studentLabel }) || undefined;
  } else {
    toPhone = resolveCoachPhone(coachId) || db.coachOwners[coachId] || undefined;
  }

  const message: NetworkCoachMessage = {
    id: newId(),
    coachId,
    text,
    at: new Date().toISOString(),
    from,
    fromPhone: fromPhone || undefined,
    fromName: sanitizeDisplayName(input.fromName || "") || undefined,
    status: from === "coach" ? "replied" : "pending",
    kind: input.kind || (from === "coach" ? "guidance" : "note"),
    jobId: input.jobId,
    studentKey: studentKey || undefined,
    studentLabel: studentLabel || undefined,
    toPhone,
  };

  const prev = Array.isArray(db.byCoach[coachId]) ? db.byCoach[coachId] : [];
  db.byCoach[coachId] = [...prev, message].slice(-MAX_PER_COACH);
  save(db);

  // ZQ-150 event 5: 站内留言（含教练）→ 对端
  const recipientPhone = toPhone;
  const recipientName =
    from === "coach" ? studentLabel || studentKey : undefined;
  notifySubscribe({
    event: "message",
    phone: recipientPhone,
    displayName: recipientName,
    page: "pages/web/web?next=%2Fcoach",
    data: {
      name: message.fromName || (from === "coach" ? "教练" : "学员"),
      peerName: message.fromName || (from === "coach" ? "教练" : "学员"),
      body: message.text,
      detail: message.text,
    },
  });

  return { ok: true, message };
}

export function publicMessage(m: NetworkCoachMessage) {
  return {
    id: m.id,
    coachId: m.coachId,
    text: m.text,
    at: m.at,
    from: m.from,
    fromName: m.fromName || "",
    status: m.status || null,
    kind: m.kind || null,
    jobId: m.jobId || null,
    studentKey: m.studentKey || null,
    studentLabel: m.studentLabel || null,
  };
}
