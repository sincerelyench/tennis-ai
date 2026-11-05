import { registerWithPassword } from "@/lib/auth-store";
import { applySessionCookie, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username) return json(request, { error: "Enter a username" }, 400);
  if (!password) return json(request, { error: "Enter a password" }, 400);

  const result = registerWithPassword(username, password);
  if ("error" in result) return json(request, { error: result.error }, 400);

  const response = json(request, {
    ok: true,
    token: result.token,
    phone: result.phone,
    role: result.role,
    displayName: result.displayName,
    cityId: result.cityId,
    username: result.username,
    needsProfileSetup: result.needsProfileSetup,
  });
  applySessionCookie(response, request, result.token);
  return response;
}
