import { cookies } from "next/headers";
import {
  getSession,
  sessionCookie,
  updateProfile,
  sanitizeDisplayName,
  sanitizeWechatId,
} from "@/lib/auth-store";
import { sanitizeGender } from "@/lib/player-gender";
import { bearerToken, json, preflight } from "@/lib/auth-http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token, { fresh: true });
  if (!session) return json(request, { error: "Please sign in" }, 401);
  return json(request, {
    phone: session.phone,
    role: session.role,
    displayName: session.displayName || "",
    cityId: session.cityId || "",
    wechatId: session.wechatId || "",
    matchHistoryPublic: session.matchHistoryPublic !== false,
    level: session.level,
    gender: session.gender || "",
    needsProfileSetup: session.needsProfileSetup,
  });
}

export async function PATCH(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token, { fresh: true });
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: {
    displayName?: string;
    cityId?: string;
    wechatId?: string;
    level?: number | null;
    matchHistoryPublic?: boolean;
    gender?: string | null;
  } = {};
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

  if (body.wechatId !== undefined) {
    const cleaned = sanitizeWechatId(body.wechatId);
    if (String(body.wechatId || "").trim() && !cleaned) {
      return json(request, { error: "Enter a valid WeChat ID" }, 400);
    }
  }

  let genderPatch: "female" | "male" | null | undefined = undefined;
  if (body.gender !== undefined) {
    if (body.gender === null || String(body.gender).trim() === "") {
      genderPatch = null;
    } else {
      const g = sanitizeGender(body.gender);
      if (!g) return json(request, { error: "Invalid gender" }, 400);
      genderPatch = g;
    }
  }

  const updated = updateProfile(session.phone, {
    displayName: body.displayName,
    cityId: body.cityId,
    wechatId: body.wechatId,
    level: body.level,
    matchHistoryPublic:
      body.matchHistoryPublic === undefined ? undefined : body.matchHistoryPublic !== false,
    gender: genderPatch,
  });
  if ("error" in updated) return json(request, { error: updated.error }, 401);
  return json(request, { ok: true, ...updated });
}
