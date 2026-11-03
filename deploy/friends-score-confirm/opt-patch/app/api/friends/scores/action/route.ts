import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import { confirmScore, publicScore, rejectScore } from "@/lib/match-scores";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * POST /api/friends/scores/action
 * Body: { id, action: "confirm" | "reject" }
 * Opponent confirmation unlocks ranking / UTR updates.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  let body: { id?: string; action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim().toLowerCase();
  if (!id) return json(request, { error: "Missing score id" }, 400);
  if (action !== "confirm" && action !== "reject") {
    return json(request, { error: "action must be confirm or reject" }, 400);
  }

  const sess = { phone: session.phone, displayName: session.displayName || "" };
  const result = action === "confirm" ? confirmScore(id, sess) : rejectScore(id, sess);
  if ("error" in result) {
    return json(request, { error: result.error }, result.status || 400);
  }

  return json(request, {
    ok: true,
    action,
    score: publicScore(result.score),
    rankingUpdated: action === "confirm",
  });
}
