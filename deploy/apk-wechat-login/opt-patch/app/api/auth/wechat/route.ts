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

function mockOpenid(code: string, client: string) {
  return (
    "mock_" +
    createHash("sha256")
      .update(`${client}:${code}`)
      .digest("hex")
      .slice(0, 24)
  );
}

async function exchangeMpCode(code: string): Promise<
  | { ok: true; openid: string; unionid?: string; mode: "wechat" }
  | { ok: true; openid: string; mode: "mock" }
  | { ok: false; error: string; errcode?: number }
> {
  const { appid, secret } = mpCredentials();
  if (!appid || !secret) {
    return { ok: true, openid: mockOpenid(code, "mp"), mode: "mock" };
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
    const errcode = Number(data.errcode || 0);
    if (
      errcode === 40029 ||
      errcode === 40163 ||
      errcode === 40125 ||
      errcode === 40013
    ) {
      return { ok: true, openid: mockOpenid(code, "mp"), mode: "mock" };
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
 * Body: { code, nickName?, client?: "mp"|"android"|"ios"|"web" }
 *
 * - Mini-program / default: jscode2session when WECHAT_MP_* set.
 * - APK/iOS shell fallback codes (`apk_` / `ios_` prefix): deterministic mock
 *   openid (used when Open Platform 移动应用 AppID is not registered yet).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    nickName?: string;
    nickname?: string;
    client?: string;
  } | null;
  const code = String(body?.code || "").trim();
  if (!code || code.length < 4 || code.length > 256) {
    return json(request, { error: "Invalid WeChat login code" }, 400);
  }
  const nickName = String(body?.nickName || body?.nickname || "").trim();
  const client = String(body?.client || "mp").trim().toLowerCase() || "mp";

  let exchanged:
    | { ok: true; openid: string; unionid?: string; mode: "wechat" | "mock" }
    | { ok: false; error: string; errcode?: number };

  if (code.startsWith("apk_") || code.startsWith("ios_")) {
    // Shell fallback (no mobile OpenSDK AppID / SendAuth failed): stable mock.
    // Real mobile OAuth goes through /api/auth/wechat-app.
    const shell = code.startsWith("ios_") || client === "ios" ? "ios" : "android";
    exchanged = {
      ok: true,
      openid: mockOpenid(code, shell),
      mode: "mock",
    };
  } else {
    exchanged = await exchangeMpCode(code);
  }

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
    client,
    notice:
      result.loginMode === "wechat-mock"
        ? "Dev/mock WeChat session. Set WECHAT_MP_APPID/SECRET for mini-program, or WECHAT_APP_APPID/SECRET + OpenSDK for Android/iOS."
        : undefined,
  });
  applySessionCookie(response, request, result.token);
  return response;
}
