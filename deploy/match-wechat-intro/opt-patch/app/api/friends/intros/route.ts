import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  acceptIntro,
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

  const listed = listIntrosForUser({
    phone: session.phone,
    displayName: session.displayName || "",
  });
  const locale = request.headers.get("accept-language") || "";

  return json(request, {
    ok: true,
    active: listed.active.map((row) => publicIntro(row, locale)),
    inbox: listed.inbox.map((row) => publicIntro(row, locale)),
    mine: listed.mine.map((row) => publicIntro(row, locale)),
    count: listed.count,
    empty: listed.count === 0,
  });
}

/** POST /api/friends/intros — action: create | accept | cancel | reply */
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
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint) });
  }

  const id = String(body.id || "");
  if (!id) return json(request, { error: "Missing id" }, 400);
  const sessionUser = { phone: session.phone, displayName: session.displayName || "" };

  if (action === "accept") {
    const result = acceptIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint) });
  }
  if (action === "cancel") {
    const result = cancelIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint) });
  }
  if (action === "reply") {
    const result = replyIntro(id, sessionUser);
    if ("error" in result) return json(request, { error: result.error }, 400);
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint) });
  }

  return json(request, { error: "Unknown action" }, 400);
}
