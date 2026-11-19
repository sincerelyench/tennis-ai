/**
 * 涨球乐 · 微信小程序订阅消息（subscribeMessage.send）
 * ZQ-150 — additive push for MP users with openid; in-app notices stay.
 *
 * Env (template IDs from 微信公众平台 → 订阅消息 → 我的模板):
 *   WECHAT_MP_APPID / WECHAT_MP_SECRET   (already used by /api/auth/wechat)
 *   WECHAT_MP_TMPL_LADDER               排行榜分数/名次变动
 *   WECHAT_MP_TMPL_INVITE               收到约战/挑战邀请
 *   WECHAT_MP_TMPL_INVITE_ACCEPTED      发出的邀请被接受
 *   WECHAT_MP_TMPL_SCORE_CONFIRM        比分结果与综述确认邀请
 *   WECHAT_MP_TMPL_MESSAGE              站内留言
 *
 * Field keys below match the recommended public-library titles in
 * deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md — adjust if
 * Yanqing's console templates use different keyword ordinals.
 */
import { getUser, listDirectoryUsers, sanitizeDisplayName } from "@/lib/auth-store";
import {
  consumeSubscribeCredit,
  type SubscribeEvent,
} from "@/lib/wechat-subscribe-store";

export type { SubscribeEvent };

export const SUBSCRIBE_EVENTS: SubscribeEvent[] = [
  "ladder",
  "invite",
  "invite_accepted",
  "score_confirm",
  "message",
];

const ENV_TMPL: Record<SubscribeEvent, string> = {
  ladder: "WECHAT_MP_TMPL_LADDER",
  invite: "WECHAT_MP_TMPL_INVITE",
  invite_accepted: "WECHAT_MP_TMPL_INVITE_ACCEPTED",
  score_confirm: "WECHAT_MP_TMPL_SCORE_CONFIRM",
  message: "WECHAT_MP_TMPL_MESSAGE",
};

/** Default jump page inside the mini program (web-view shell). */
const DEFAULT_PAGE = "pages/web/web";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function mpCredentials() {
  const appid = (
    process.env.WECHAT_MP_APPID ||
    process.env.WECHAT_APPID ||
    ""
  ).trim();
  const secret = (
    process.env.WECHAT_MP_SECRET ||
    process.env.WECHAT_SECRET ||
    ""
  ).trim();
  return { appid, secret };
}

export function templateIdFor(event: SubscribeEvent): string {
  const key = ENV_TMPL[event];
  return String(process.env[key] || "").trim();
}

export function configuredTemplateIds(): Partial<Record<SubscribeEvent, string>> {
  const out: Partial<Record<SubscribeEvent, string>> = {};
  for (const ev of SUBSCRIBE_EVENTS) {
    const id = templateIdFor(ev);
    if (id) out[ev] = id;
  }
  return out;
}

export function allConfiguredTmplIds(): string[] {
  const ids = SUBSCRIBE_EVENTS.map(templateIdFor).filter(Boolean);
  return Array.from(new Set(ids));
}

/** Resolve raw WeChat openid for a phone / wx_ account / display name. */
export function resolveOpenid(opts: {
  phone?: string | null;
  displayName?: string | null;
}): string | null {
  const phone = String(opts.phone || "").trim();
  if (phone) {
    const user = getUser(phone);
    if (user?.openid) return String(user.openid).trim() || null;
    if (phone.startsWith("wx_") && phone.length > 3) {
      return phone.slice(3);
    }
  }
  const name = sanitizeDisplayName(opts.displayName || "");
  if (!name) return null;
  const hits = listDirectoryUsers({ role: "any" }).filter(
    (u) => sanitizeDisplayName(u.displayName || "") === name,
  );
  for (const u of hits) {
    const full = getUser(u.phone);
    if (full?.openid) return String(full.openid).trim() || null;
    if (u.phone.startsWith("wx_") && u.phone.length > 3) return u.phone.slice(3);
  }
  return null;
}

function clip(raw: string, max: number) {
  const s = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function thing(value: string, max = 20) {
  return { value: clip(value, max) || "-" };
}

function timeNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    value: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Build template data. Keys follow the recommended 公共模板库 field layout
 * in WECHAT-CONSOLE-TEMPLATES.md (thing/phrase/time ordinals).
 */
export function buildTemplateData(
  event: SubscribeEvent,
  payload: Record<string, string | number | undefined | null>,
): Record<string, { value: string }> {
  const name = clip(String(payload.name || payload.peerName || "球友"), 10);
  const detail = clip(String(payload.detail || payload.body || ""), 20);
  switch (event) {
    case "ladder":
      return {
        thing1: thing(String(payload.title || "排行榜分数变动")),
        thing2: thing(
          String(
            payload.summary ||
              `分数 ${payload.score ?? "-"} · 名次 ${payload.rank ?? "-"}`,
          ),
        ),
        time3: timeNow(),
      };
    case "invite":
      // Yanqing template「用户邀约通知」y3dQG1ss-… : thing1 邀约标题 / thing2 邀约内容 / thing13 邀请人
      return {
        thing1: thing(String(payload.title || "约球邀请")),
        thing2: thing(
          String(
            payload.detail ||
              payload.body ||
              (payload.kind === "challenge" ? "有人向你发起挑战，请打开涨球乐应战" : "有人邀你约球，请打开涨球乐查看"),
          ),
        ),
        thing13: thing(String(payload.name || payload.peerName || name || "球友")),
      };
    case "invite_accepted":
      return {
        name1: { value: clip(name, 10) || "球友" },
        phrase2: { value: clip(String(payload.status || "已应战"), 5) || "已应战" },
        time3: timeNow(),
      };
    case "score_confirm":
      return {
        name1: { value: clip(name, 10) || "对手" },
        thing2: thing(String(payload.scoreText || payload.title || "待确认比分")),
        thing3: thing(String(payload.review || detail || "请确认比分与综述")),
        time4: timeNow(),
      };
    case "message":
    default:
      return {
        name1: { value: clip(name, 10) || "留言" },
        thing2: thing(detail || "你有一条新站内留言"),
        time3: timeNow(),
      };
  }
}

async function getAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string; skipped?: boolean }
> {
  const { appid, secret } = mpCredentials();
  if (!appid || !secret) {
    return { ok: false, error: "WECHAT_MP_APPID/SECRET missing", skipped: true };
  }
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return { ok: true, token: tokenCache.token };
  }
  const url =
    "https://api.weixin.qq.com/cgi-bin/token" +
    `?grant_type=client_credential&appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    };
    if (!data.access_token) {
      return {
        ok: false,
        error: data.errmsg || `token errcode=${data.errcode || "?"}`,
      };
    }
    const ttl = Math.max(60, Number(data.expires_in || 7200) - 120) * 1000;
    tokenCache = { token: data.access_token, expiresAt: now + ttl };
    return { ok: true, token: data.access_token };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network";
    return { ok: false, error: `token fetch failed: ${message}` };
  }
}

export type SendSubscribeResult =
  | { ok: true; msgid?: string | number }
  | {
      ok: false;
      error: string;
      errcode?: number;
      skipped?: boolean;
    };

/**
 * Send one subscribe message. Never throws — safe to fire-and-forget from hooks.
 * Skips when openid / template id / credentials / remaining credit missing.
 */
export async function sendSubscribeMessage(opts: {
  event: SubscribeEvent;
  openid?: string | null;
  phone?: string | null;
  displayName?: string | null;
  page?: string;
  data?: Record<string, string | number | undefined | null>;
  /** When true (default), require a stored accept credit for once-type templates. */
  requireCredit?: boolean;
}): Promise<SendSubscribeResult> {
  const event = opts.event;
  const templateId = templateIdFor(event);
  if (!templateId) {
    return { ok: false, error: `template id unset (${ENV_TMPL[event]})`, skipped: true };
  }

  const openid =
    String(opts.openid || "").trim() ||
    resolveOpenid({ phone: opts.phone, displayName: opts.displayName }) ||
    "";
  if (!openid) {
    return { ok: false, error: "no openid (user never MP WeChat-login)", skipped: true };
  }

  const phoneHint =
    String(opts.phone || "").trim() ||
    (openid ? `wx_${openid}` : "");
  if (opts.requireCredit !== false) {
    const credit = consumeSubscribeCredit({
      phone: phoneHint,
      openid,
      event,
    });
    if (!credit.ok) {
      return { ok: false, error: credit.error || "no subscribe credit", skipped: true };
    }
  }

  const tokenRes = await getAccessToken();
  if (!tokenRes.ok) {
    return { ok: false, error: tokenRes.error, skipped: tokenRes.skipped };
  }

  const page = String(opts.page || DEFAULT_PAGE).replace(/^\//, "");
  const data = buildTemplateData(event, opts.data || {});
  const body = {
    touser: openid,
    template_id: templateId,
    page,
    miniprogram_state: String(process.env.WECHAT_MP_STATE || "formal").trim() || "formal",
    lang: "zh_CN",
    data,
  };

  try {
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(tokenRes.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const json = (await res.json()) as {
      errcode?: number;
      errmsg?: string;
      msgid?: string | number;
    };
    const errcode = Number(json.errcode || 0);
    if (errcode === 0) {
      return { ok: true, msgid: json.msgid };
    }
    // 43101 = user refused / no subscription; treat as soft skip
    if (errcode === 43101) {
      return { ok: false, error: "user refused or no subscription", errcode, skipped: true };
    }
    return {
      ok: false,
      error: json.errmsg || `send errcode=${errcode}`,
      errcode,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network";
    return { ok: false, error: `send failed: ${message}` };
  }
}

/** Fire-and-forget wrapper — never rejects. */
export function notifySubscribe(
  opts: Parameters<typeof sendSubscribeMessage>[0],
): void {
  void sendSubscribeMessage(opts).catch((err) => {
    console.warn("[wechat-subscribe]", opts.event, err);
  });
}
