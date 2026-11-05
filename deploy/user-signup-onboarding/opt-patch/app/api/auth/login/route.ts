import { loginWithCode, loginWithPassword, normalizePhone, normalizeUsername } from "@/lib/auth-store";
import { applySessionCookie, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    code?: string;
    username?: string;
    password?: string;
  } | null;

  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const wantsPassword = Boolean(username || password) && !body?.code;

  if (wantsPassword || (username && password && !body?.phone)) {
    if (!username) return json(request, { error: "Enter a username or phone number" }, 400);
    if (!password) return json(request, { error: "Enter your password" }, 400);
    const result = loginWithPassword(username, password);
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

  const phone = normalizePhone(body?.phone || username || "");
  const code = (body?.code || "").trim();
  if (!phone) {
    // Username without password → guide to password mode rather than phone-only error.
    if (normalizeUsername(username) || username) {
      return json(request, { error: "Enter your password, or switch to phone verification" }, 400);
    }
    return json(request, { error: "Enter an 11-digit phone number" }, 400);
  }
  if (!/^\d{4}$/.test(code)) return json(request, { error: "Enter the 4-digit verification code" }, 400);
  const result = loginWithCode(phone, code);
  if ("error" in result) return json(request, { error: result.error }, 400);
  const response = json(request, {
    ok: true,
    token: result.token,
    phone: result.phone,
    role: result.role,
    displayName: result.displayName,
    cityId: result.cityId,
    needsProfileSetup: result.needsProfileSetup,
  });
  applySessionCookie(response, request, result.token);
  return response;
}
