import { NextResponse } from "next/server";
import { sessionCookie, sessionMaxAge } from "@/lib/auth-store";

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers();
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  return headers;
}

export function json(request: Request, body: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json");
  return new NextResponse(JSON.stringify(body), { status, headers });
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return match?.[1] || "";
}

export function cookieOptions(request: Request) {
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure = forwarded ? forwarded.split(",")[0].trim() === "https" : request.url.startsWith("https:");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/tennis",
    maxAge: sessionMaxAge,
  };
}

export function applySessionCookie(response: NextResponse, request: Request, token: string) {
  response.cookies.set(sessionCookie, token, cookieOptions(request));
}

export function clearSessionCookie(response: NextResponse, request: Request) {
  response.cookies.set(sessionCookie, "", { ...cookieOptions(request), maxAge: 0 });
}
