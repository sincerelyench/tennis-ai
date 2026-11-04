import { createHash } from "crypto";
import { loginWithWeChat } from "@/lib/auth-store";
import { applySessionCookie, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

type OAuthToken = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

function appCredentials() {
  const appid = (
    process.env.WECHAT_APP_APPID ||
    process.env.WECHAT_OPEN_APPID ||
    ""
  ).trim();
  const secret = (
    process.env.WECHAT_APP_SECRET ||
    process.env.WECHAT_OPEN_SECRET ||
    ""
  ).trim();
  return { appid, secret };
}

function mockOpenid(code: string) {
  return "mock_" + createHash("sha256").update(`app:${code}`).digest("hex").slice(0, 24);
}

/**
 * POST /api/auth/wechat-app
 * Body: { code from OpenSDK SendAuth, nickName?, client?: "android"|"ios" }
 *
 * Exchanges via sns/oauth2/access_token when WECHAT_APP_APPID + WECHAT_APP_SECRET
 * are set (微信开放平台 · 移动应用). Otherwise deterministic mock openid so the
 * APK button still completes a 涨球 session for demos.
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
    return json(request, { error: "Invalid WeChat app login code" }, 400);
  }
  const nickName = String(body?.nickName || body?.nickname || "").trim();
  const client = String(body?.client || "android").trim().toLowerCase() || "android";
  const { appid, secret } = appCredentials();

  let openid = "";
  let unionid: string | undefined;
  let mode: "wechat" | "mock" = "mock";

  if (appid && secret && !code.startsWith("apk_") && !code.startsWith("ios_")) {
    const url =
      "https://api.weixin.qq.com/sns/oauth2/access_token" +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&code=${encodeURIComponent(code)}` +
      "&grant_type=authorization_code";
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const data = (await res.json()) as OAuthToken;
      if (data.openid) {
        openid = data.openid;
        unionid = data.unionid;
        mode = "wechat";
      } else {
        const errcode = Number(data.errcode || 0);
        if (errcode === 40029 || errcode === 40163 || errcode === 40125 || errcode === 40013) {
          openid = mockOpenid(code);
          mode = "mock";
        } else {
          return json(
            request,
            { error: data.errmsg || "WeChat app OAuth failed", errcode },
            400,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "network";
      return json(request, { error: `WeChat unreachable: ${message}` }, 502);
    }
  } else {
    openid = mockOpenid(code);
    mode = "mock";
  }

  const result = loginWithWeChat({
    openid,
    unionid,
    nickName,
    loginMode: mode === "wechat" ? "wechat-app" : "wechat-mock",
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
      mode === "mock"
        ? "Mock WeChat app session. Register 移动应用 on open.weixin.qq.com and set WECHAT_APP_APPID + WECHAT_APP_SECRET."
        : undefined,
  });
  applySessionCookie(response, request, result.token);
  return response;
}
