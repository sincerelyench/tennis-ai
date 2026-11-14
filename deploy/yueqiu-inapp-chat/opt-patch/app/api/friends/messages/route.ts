import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  ackMessagesForIntro,
  listMessagesForIntro,
  postMessageToIntro,
  publicIntro,
  publicMessage,
} from "@/lib/match-intros";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** GET /api/friends/messages?introId=… — thread for a successful match */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const introId = String(url.searchParams.get("introId") || "").trim();
  if (!introId) return json(request, { error: "Missing introId" }, 400);

  const sessionUser = {
    phone: session.phone,
    displayName: session.displayName || "",
  };
  const locale = request.headers.get("accept-language") || "";
  const listed = listMessagesForIntro(introId, sessionUser);
  if ("error" in listed) {
    const status = listed.error === "Not found" ? 404 : 400;
    return json(request, { error: listed.error }, status);
  }

  // Opening the thread clears unread for this user
  ackMessagesForIntro(introId, sessionUser);

  return json(request, {
    ok: true,
    intro: publicIntro(listed.intro, locale, sessionUser),
    messages: listed.messages.map((m) => publicMessage(m, sessionUser.phone)),
  });
}

/** POST /api/friends/messages — action: send | ack */
export async function POST(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: {
    action?: string;
    introId?: string;
    id?: string;
    body?: string;
    text?: string;
    locale?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const sessionUser = {
    phone: session.phone,
    displayName: session.displayName || "",
  };
  const localeHint = body.locale || request.headers.get("accept-language") || "zh";
  const introId = String(body.introId || body.id || "").trim();
  if (!introId) return json(request, { error: "Missing introId" }, 400);

  const action = String(body.action || "send").trim();

  if (action === "ack") {
    const result = ackMessagesForIntro(introId, sessionUser);
    if ("error" in result) {
      const status = result.error === "Not found" ? 404 : 400;
      return json(request, { error: result.error }, status);
    }
    return json(request, { ok: true, intro: publicIntro(result.intro, localeHint, sessionUser) });
  }

  if (action === "send" || action === "create") {
    const text = String(body.body || body.text || "");
    const result = postMessageToIntro(introId, sessionUser, text);
    if ("error" in result) {
      const status = result.error === "Not found" ? 404 : 400;
      return json(request, { error: result.error }, status);
    }
    return json(request, {
      ok: true,
      intro: publicIntro(result.intro, localeHint, sessionUser),
      message: publicMessage(result.message, sessionUser.phone),
      messages: result.messages.map((m) => publicMessage(m, sessionUser.phone)),
    });
  }

  return json(request, { error: "Unknown action" }, 400);
}
