import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  acceptIntro,
  ackAcceptedIntro,
  ackAllAcceptedForUser,
  cancelIntro,
  createMatchIntro,
  listIntrosForUser,
  publicIntro,
  replyIntro,
  type IntroKind,
} from "@/lib/match-intros";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** GET /api/friends/intros */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const sessionUser = {
    phone: session.phone,
    displayName: session.displayName || "",
  };
  const listed = listIntrosForUser(sessionUser);
  const locale = request.headers.get("accept-language") || "";

  return json(request, {
    ok: true,
    active: listed.active.map((row) => publicIntro(row, locale, sessionUser)),
    inbox: listed.inbox.map((row) => publicIntro(row, locale, sessionUser)),
    mine: listed.mine.map((row) => publicIntro(row, locale, sessionUser)),
    pendingAccept: listed.pendingAccept.map((row) => publicIntro(row, locale, sessionUser)),
    acceptedNotify: listed.acceptedNotify.map((row) => publicIntro(row, locale, sessionUser)),
    success: listed.success.map((row) => publicIntro(row, locale, sessionUser)),
    count: listed.count,
    badge: listed.badge,
    empty: listed.count === 0,
  });
}

/** POST /api/friends/intros — action: create | accept | decline | cancel | reply | ackAccepted | ackAllAccepted */
export async function POST(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: {
    action?: string;
    id?: string;
    toName?: string;
    buddyId?: string;
    cityId?: string;
    locale?: string;
    kind?: IntroKind;
    openIntro?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "create");
  const localeHint = body.locale || request.headers.get("accept-language") || "zh";
  const sessionUser = { phone: session.phone, displayName: session.displayName || "" };

  if (action === "create") {
    const result = createMatchIntro({
      fromPhone: session.phone,
      fromName: session.displayName || "",
      toName: String(body.toName || ""),
      buddyId: String(body.buddyId || body.toName || ""),
      cityId: body.cityId,
      locale: localeHint,
      kind: body.kind === "challenge" ? "challenge" : "match",
      openIntro: body.openIntro,
    });
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }

  if (action === "ackAllAccepted") {
    const cleared = ackAllAcceptedForUser(sessionUser);
    return json(request, { ok: true, cleared });
  }

  const id = String(body.id || "");
  if (!id) return json(request, { error: "Missing id" }, 400);

  if (action === "accept") {
    const result = acceptIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }
  // decline = 对方婉拒应战（与 cancel 同一落库路径）
  if (action === "cancel" || action === "decline") {
    const result = cancelIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }
  if (action === "reply") {
    const result = replyIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }
  if (action === "ackAccepted") {
    const result = ackAcceptedIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }

  return json(request, { error: "Unknown action" }, 400);
}
