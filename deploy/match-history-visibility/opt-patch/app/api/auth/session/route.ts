import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);
  return json(request, {
    phone: session.phone,
    role: session.role,
    displayName: session.displayName || "",
    cityId: session.cityId || "",
    wechatId: session.wechatId || "",
    matchHistoryPublic: session.matchHistoryPublic !== false,
    level: session.level,
    needsProfileSetup: session.needsProfileSetup,
  });
}
