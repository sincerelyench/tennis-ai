import { cookies } from "next/headers";
import {
  getSession,
  sessionCookie,
  updateProfile,
  sanitizeDisplayName,
} from "@/lib/auth-store";
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
    level: session.level,
  });
}

export async function PATCH(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: { displayName?: string; cityId?: string; level?: number | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  if (body.displayName !== undefined) {
    const cleaned = sanitizeDisplayName(body.displayName);
    if (String(body.displayName || "").trim() && !cleaned) {
      return json(request, { error: "That display name is not allowed" }, 400);
    }
  }

  const updated = updateProfile(session.phone, {
    displayName: body.displayName,
    cityId: body.cityId,
    level: body.level,
  });
  if ("error" in updated) return json(request, { error: updated.error }, 401);
  return json(request, { ok: true, ...updated });
}
