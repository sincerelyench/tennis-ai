import { cookies } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  addScoreComment,
  deleteScoreComment,
  getScoreById,
  publicComment,
  publicScore,
} from "@/lib/match-scores";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

type Ctx = { params: Promise<{ id: string }> };

async function requireSession(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  return getSession(token);
}

/**
 * GET /api/friends/scores/[id]/comments
 */
export async function GET(request: Request, ctx: Ctx) {
  const session = await requireSession(request);
  if (!session) return json(request, { error: "请先登录" }, 401);

  const { id } = await ctx.params;
  const score = getScoreById(String(id || "").trim());
  if (!score) return json(request, { error: "比分不存在" }, 404);

  const comments = Array.isArray(score.comments) ? score.comments : [];
  return json(request, {
    ok: true,
    scoreId: score.id,
    comments: comments.map(publicComment),
    count: comments.length,
    selfPhone: session.phone,
  });
}

/**
 * POST /api/friends/scores/[id]/comments
 * Body: { body: string } — any signed-in user
 * Or { action: "delete", commentId } — author only
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await requireSession(request);
  if (!session) return json(request, { error: "请先登录" }, 401);

  const { id } = await ctx.params;
  const scoreId = String(id || "").trim();
  if (!scoreId) return json(request, { error: "缺少比分 id" }, 400);

  let body: { body?: string; action?: string; commentId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: "无效 JSON" }, 400);
  }

  const sess = { phone: session.phone, displayName: session.displayName || "" };
  const action = String(body.action || "").trim().toLowerCase();

  if (action === "delete") {
    const commentId = String(body.commentId || "").trim();
    if (!commentId) return json(request, { error: "缺少评论 id" }, 400);
    const result = deleteScoreComment(scoreId, commentId, sess);
    if ("error" in result) {
      return json(request, { error: result.error }, result.status || 400);
    }
    const comments = Array.isArray(result.score.comments) ? result.score.comments : [];
    return json(request, {
      ok: true,
      deleted: true,
      score: publicScore(result.score),
      comments: comments.map(publicComment),
      count: comments.length,
    });
  }

  const result = addScoreComment(scoreId, sess, String(body.body || ""));
  if ("error" in result) {
    return json(request, { error: result.error }, result.status || 400);
  }
  const comments = Array.isArray(result.score.comments) ? result.score.comments : [];
  return json(request, {
    ok: true,
    comment: publicComment(result.comment),
    score: publicScore(result.score),
    comments: comments.map(publicComment),
    count: comments.length,
  });
}
