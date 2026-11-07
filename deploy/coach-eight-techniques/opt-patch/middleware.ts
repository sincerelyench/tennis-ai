import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const sessionCookie = "tennis_session";
const publicPaths = [
  "/login",
  "/share",
  "/api/auth/code",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/wechat",
  "/api/auth/mp-enter",
  "/api/auth/wechat-app",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/geo/city",
  "/examples",
  "/icon.png",
  "/apple-icon.png",
  "/favicon.ico",
  "/demo-video-clean-preview.html", "/remove-analyze-preview.html", "/match-record-analyze.html",
  "/report-four-dim-preview.html",
  "/coach-eight-techniques.html",
];

function withCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, OPTIONS");
    response.headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  }
  return response;
}

export function middleware(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (p.includes("network-coach-chat")) return NextResponse.next();
  if (p.includes("coach-eight-techniques")) return NextResponse.next();
  if (p.includes("friends-matchmaking")) return NextResponse.next();
  if (p.includes("zq-friends-matchmaking-inject")) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // WebView shells call the API cross-origin from appassets / app://. OPTIONS
  // preflight has no Bearer token. If we auth here, the browser drops the real
  // analysis and coach requests.
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return withCors(request, new NextResponse(null, { status: 204 }));
  }
  if (/^(\/tennis)?\/api\/clips\/[^/]+$/.test(pathname) && (request.method === "GET" || request.method === "HEAD")) {
    return withCors(request, NextResponse.next());
  }
  if (
    /^(\/tennis)?\/api\/jobs\/[^/]+\/(overlay\.mp4|source\.mp4|preview\.jpg|cover\.jpg)$/.test(pathname) &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return withCors(request, NextResponse.next());
  }
  if (/^(\/tennis)?\/api\/journey\/share\/[^/]+$/.test(pathname) && request.method === "GET") {
    return withCors(request, NextResponse.next());
  }
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return withCors(request, NextResponse.next());
  }
  const cookie = request.cookies.get(sessionCookie)?.value;
  const bearer = request.headers.get("authorization") || "";
  const hasBearer = /^Bearer\s+[a-f0-9]{64}$/i.test(bearer);
  if (pathname.startsWith("/api/")) {
    if (cookie || hasBearer) return withCors(request, NextResponse.next());
    return withCors(request, NextResponse.json({ error: "Please sign in" }, { status: 401 }));
  }
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|star-demos\\.json|analyze-progress-preview\\.html|demo-video-clean-preview\\.html|report-four-dim-preview\\.html).*)"],
};
