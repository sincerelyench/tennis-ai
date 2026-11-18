/**
 * GET  /api/coach/messages?coachId=… — list board for coach / selected player
 * POST /api/coach/messages — persist coach↔player 留言 + WeChat subscribe (event 5)
 */
import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  listMessagesForCoach,
  listMessagesForStudent,
  postNetworkCoachMessage,
  publicMessage,
  type BoardFrom,
} from "@/lib/network-coach-messages";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

async function sessionUser(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  return getSession(token);
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const coachId = String(url.searchParams.get("coachId") || "").trim();
  if (!coachId) return json(request, { error: "Missing coachId" }, 400);

  const isCoach = session.role === "coach";
  const studentKey = String(url.searchParams.get("studentKey") || "").trim();

  const rows = isCoach
    ? listMessagesForCoach(coachId)
    : listMessagesForStudent({
        coachId,
        studentPhone: session.phone,
        studentKey: studentKey || session.phone,
      });

  return json(request, {
    ok: true,
    coachId,
    messages: rows.map(publicMessage),
  });
}

export async function POST(request: Request) {
  const session = await sessionUser(request);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: {
    coachId?: string;
    text?: string;
    body?: string;
    kind?: "video-guidance" | "note" | "guidance";
    jobId?: string;
    studentKey?: string;
    studentLabel?: string;
    from?: BoardFrom;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const coachId = String(body.coachId || "").trim();
  const text = String(body.text || body.body || "").trim();
  if (!coachId) return json(request, { error: "Missing coachId" }, 400);
  if (!text) return json(request, { error: "Empty message" }, 400);

  const isCoach = session.role === "coach";
  const from: BoardFrom =
    body.from === "coach" || body.from === "student"
      ? body.from
      : isCoach
        ? "coach"
        : "student";

  // Players may not spoof coach-from; coaches may not spoof student-from unless explicit.
  if (!isCoach && from === "coach") {
    return json(request, { error: "Only coaches can post guidance" }, 403);
  }

  const result = postNetworkCoachMessage({
    coachId,
    text,
    from,
    fromPhone: session.phone,
    fromName: session.displayName || "",
    kind: body.kind,
    jobId: body.jobId ? String(body.jobId) : undefined,
    studentKey:
      from === "student"
        ? session.phone
        : String(body.studentKey || "").trim() || undefined,
    studentLabel:
      from === "student"
        ? session.displayName || undefined
        : String(body.studentLabel || "").trim() || undefined,
  });

  if ("error" in result) {
    return json(request, { error: result.error }, 400);
  }

  return json(request, {
    ok: true,
    message: publicMessage(result.message),
    messages: listMessagesForCoach(coachId).map(publicMessage),
  });
}
