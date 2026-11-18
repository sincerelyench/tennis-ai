/**
 * GET  /api/auth/wechat-subscribe — template ids + current credits for session
 * POST /api/auth/wechat-subscribe — record wx.requestSubscribeMessage accepts
 */
import { cookies } from "next/headers";
import { getSession, getUser, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  SUBSCRIBE_EVENTS,
  configuredTemplateIds,
  allConfiguredTmplIds,
  type SubscribeEvent,
} from "@/lib/wechat-subscribe";
import {
  getSubscribeCredits,
  recordSubscribeAccepts,
} from "@/lib/wechat-subscribe-store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

async function sessionUser(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return null;
  const user = getUser(session.phone);
  return {
    phone: session.phone,
    displayName: session.displayName || "",
    openid: user?.openid || (session.phone.startsWith("wx_") ? session.phone.slice(3) : ""),
  };
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  const templates = configuredTemplateIds();
  const tmplIds = allConfiguredTmplIds();
  const events = SUBSCRIBE_EVENTS;
  if (!session) {
    return json(request, {
      ok: true,
      events,
      templates,
      tmplIds,
      credits: {},
      configured: tmplIds.length > 0,
      notice:
        tmplIds.length === 0
          ? "Template IDs not set — fill WECHAT_MP_TMPL_* on server after 公众平台创建."
          : undefined,
    });
  }
  const credits = getSubscribeCredits({
    phone: session.phone,
    openid: session.openid,
  });
  return json(request, {
    ok: true,
    events,
    templates,
    tmplIds,
    credits,
    configured: tmplIds.length > 0,
    phone: session.phone,
    openid: session.openid || null,
  });
}

export async function POST(request: Request) {
  const session = await sessionUser(request);
  if (!session) {
    return json(request, { error: "Unauthorized" }, 401);
  }
  const body = (await request.json().catch(() => null)) as {
    results?: Record<string, string>;
    /** Alternate: raw WeChat success payload keyed by template id */
    byTemplateId?: Record<string, string>;
    openid?: string;
  } | null;

  const templates = configuredTemplateIds();
  const idToEvent = new Map<string, SubscribeEvent>();
  for (const [ev, id] of Object.entries(templates) as [SubscribeEvent, string][]) {
    if (id) idToEvent.set(id, ev);
  }

  const results: Partial<Record<SubscribeEvent, string>> = {};
  if (body?.results && typeof body.results === "object") {
    for (const [k, v] of Object.entries(body.results)) {
      if ((SUBSCRIBE_EVENTS as string[]).includes(k)) {
        results[k as SubscribeEvent] = String(v || "");
      }
    }
  }
  if (body?.byTemplateId && typeof body.byTemplateId === "object") {
    for (const [tmplId, status] of Object.entries(body.byTemplateId)) {
      const ev = idToEvent.get(tmplId);
      if (ev) results[ev] = String(status || "");
    }
  }
  if (Object.keys(results).length === 0) {
    return json(request, { error: "No accept results" }, 400);
  }

  const recorded = recordSubscribeAccepts({
    phone: session.phone,
    openid: body?.openid || session.openid,
    results,
  });
  if ("error" in recorded) {
    return json(request, { error: recorded.error }, 400);
  }
  return json(request, { ok: true, credits: recorded.credits, results });
}
