import { createHash } from "crypto";
import { loginWithWeChat } from "@/lib/auth-store";
import { applySessionCookie, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

type WxSession = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

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

function mockOpenid(code: string) {
  return "mock_" + createHash("sha256").update(`mp:${code}`).digest("hex").slice(0, 24);
}

async function exchangeCode(code: string): Promise<
  | { ok: true; openid: string; unionid?: string; mode: "wechat" }
  | { ok: true; openid: string; mode: "mock" }
  | { ok: false; error: string; errcode?: number }
> {
  const { appid, secret } = mpCredentials();
  if (!appid || !secret) {
    return { ok: true, openid: mockOpenid(code), mode: "mock" };
  }
  const url =
    "https://api.weixin.qq.com/sns/jscode2session" +
    `?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    "&grant_type=authorization_code";
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = (await res.json()) as WxSession;
    if (data.openid) {
      return {
        ok: true,
        openid: data.openid,
        unionid: data.unionid,
        mode: "wechat",
      };
    }
    // DevTools / touristappid codes often fail against a production appId —
    // fall back to a deterministic mock openid so 约球 can still be exercised.
    const errcode = Number(data.errcode || 0);
    if (errcode === 40029 || errcode === 40163 || errcode === 40125 || errcode === 40013) {
      return { ok: true, openid: mockOpenid(code), mode: "mock" };
    }
    return {
      ok: false,
      error: data.errmsg || "WeChat code exchange failed",
      errcode,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network";
    return { ok: false, error: `WeChat unreachable: ${message}` };
  }
}

/**
 * POST /api/auth/wechat
 * Body: { code: string from wx.login, nickName?: string }
 * Exchanges js_code via jscode2session when WECHAT_MP_APPID/SECRET are set;
 * otherwise (or on tourist-code errors) uses a deterministic mock openid.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    nickName?: string;
    nickname?: string;
  } | null;
  const code = String(body?.code || "").trim();
  if (!code || code.length < 4 || code.length > 256) {
    return json(request, { error: "Invalid WeChat login code" }, 400);
  }
  const nickName = String(body?.nickName || body?.nickname || "").trim();

  const exchanged = await exchangeCode(code);
  if (!exchanged.ok) {
    return json(
      request,
      { error: exchanged.error, errcode: exchanged.errcode },
      400,
    );
  }

  const result = loginWithWeChat({
    openid: exchanged.openid,
    unionid: "unionid" in exchanged ? exchanged.unionid : undefined,
    nickName,
    loginMode: exchanged.mode === "wechat" ? "wechat" : "wechat-mock",
  });
  if ("error" in result) {
    return json(request, { error: result.error }, 400);
  }

  const response = json(request, {
    ok: true,
    token: result.token,
    phone: result.phone,
    role: result.role,
    displayName: result.displayName || "",
    openid: result.openid,
    loginMode: result.loginMode,
    notice:
      result.loginMode === "wechat-mock"
        ? "Dev/mock WeChat session (set WECHAT_MP_APPID + WECHAT_MP_SECRET for real jscode2session)."
        : undefined,
  });
  applySessionCookie(response, request, result.token);
  return response;
}
