import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-store";
import { applySessionCookie } from "@/lib/auth-http";

function publicOrigin(request: Request) {
  const protoHeader = request.headers.get("x-forwarded-proto");
  const hostHeader =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = (protoHeader || "https").split(",")[0].trim() || "https";
  const host = (hostHeader || "").split(",")[0].trim();
  if (host && !/^localhost(?::\d+)?$/i.test(host) && !/^127\.0\.0\.1(?::\d+)?$/.test(host)) {
    return `${proto}://${host}`;
  }
  // Prefer the public site when the internal next start host leaks through.
  return "https://yqchen.blog";
}

/**
 * GET /api/auth/mp-enter?token=…&next=/
 * WeChat mini-program web-view handoff: validate the Bearer token from
 * wx.login → /api/auth/wechat, set the httpOnly tennis_session cookie, then
 * redirect into the Next app so the shell stays pixel-parity with the website.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const nextRaw = String(url.searchParams.get("next") || "/").trim() || "/";
  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const origin = publicOrigin(request);
  const loginUrl = new URL("/tennis/login", origin);
  const homeUrl = new URL(
    "/tennis" + (nextPath === "/" ? "" : nextPath),
    origin,
  );
  if (nextPath === "/") {
    homeUrl.pathname = "/tennis";
  }

  if (!/^[a-f0-9]{64}$/i.test(token) || !getSession(token)) {
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(homeUrl);
  applySessionCookie(response, request, token);
  return response;
}
