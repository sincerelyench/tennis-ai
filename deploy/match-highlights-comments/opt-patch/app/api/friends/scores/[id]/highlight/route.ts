import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { getSession, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import {
  getScoreById,
  isScoreParticipant,
  publicScore,
  updateScoreHighlight,
} from "@/lib/match-scores";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "match-highlights");
const MAX_BYTES = 80 * 1024 * 1024; // 80MB — same as coach library
const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime", "application/octet-stream"]);

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
 * GET /api/friends/scores/[id]/highlight
 * Signed-in users can read highlight + description + comments for a score.
 */
export async function GET(request: Request, ctx: Ctx) {
  const session = await requireSession(request);
  if (!session) return json(request, { error: "请先登录" }, 401);

  const { id } = await ctx.params;
  const score = getScoreById(String(id || "").trim());
  if (!score) return json(request, { error: "比分不存在" }, 404);

  return json(request, {
    ok: true,
    score: publicScore(score),
    canEdit: isScoreParticipant(
      { phone: session.phone, displayName: session.displayName || "" },
      score,
    ),
  });
}

/**
 * POST /api/friends/scores/[id]/highlight
 * Participants only. multipart: video|file + description
 * or JSON: { description?, highlightUrl?, highlightName?, clearHighlight? }
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await requireSession(request);
  if (!session) return json(request, { error: "请先登录" }, 401);

  const { id } = await ctx.params;
  const scoreId = String(id || "").trim();
  if (!scoreId) return json(request, { error: "缺少比分 id" }, 400);

  const sess = { phone: session.phone, displayName: session.displayName || "" };
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const description =
        form.get("description") != null ? String(form.get("description")) : undefined;
      const clearHighlight = String(form.get("clearHighlight") || "") === "1";
      const file = form.get("video") || form.get("file");
      const urlField = form.get("highlightUrl");

      let highlightUrl: string | undefined;
      let highlightName: string | undefined;

      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_BYTES) {
          return json(request, { error: "视频过大（最大 80MB）" }, 400);
        }
        const type = file.type || "application/octet-stream";
        if (!ALLOWED.has(type) && !/\.(mp4|webm|mov)$/i.test(file.name || "")) {
          return json(request, { error: "请使用 mp4 / webm / mov" }, 400);
        }
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const ext = (file.name && path.extname(file.name)) || ".mp4";
        const safeExt = /^\.(mp4|webm|mov)$/i.test(ext) ? ext.toLowerCase() : ".mp4";
        const filename = `${scoreId}-${Date.now()}${safeExt}`;
        const abs = path.join(UPLOAD_DIR, filename);
        const buf = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(abs, buf);
        highlightUrl = `/tennis/match-highlights/${filename}`;
        highlightName = String(file.name || filename).slice(0, 200);
      } else if (urlField != null && String(urlField).trim()) {
        highlightUrl = String(urlField).trim();
        highlightName = String(form.get("highlightName") || "").trim() || undefined;
      }

      const result = updateScoreHighlight(scoreId, sess, {
        description,
        highlightUrl,
        highlightName,
        clearHighlight: clearHighlight && !highlightUrl,
      });
      if ("error" in result) {
        return json(request, { error: result.error }, result.status || 400);
      }
      return json(request, {
        ok: true,
        score: publicScore(result.score),
        canEdit: true,
      });
    }

    let body: {
      description?: string;
      highlightUrl?: string;
      highlightName?: string;
      clearHighlight?: boolean;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json(request, { error: "无效 JSON" }, 400);
    }

    const result = updateScoreHighlight(scoreId, sess, {
      description: typeof body.description === "string" ? body.description : undefined,
      highlightUrl: typeof body.highlightUrl === "string" ? body.highlightUrl : undefined,
      highlightName: typeof body.highlightName === "string" ? body.highlightName : undefined,
      clearHighlight: Boolean(body.clearHighlight),
    });
    if ("error" in result) {
      return json(request, { error: result.error }, result.status || 400);
    }
    return json(request, {
      ok: true,
      score: publicScore(result.score),
      canEdit: true,
    });
  } catch (err) {
    return json(
      request,
      { error: "保存失败", detail: String(err) },
      500,
    );
  }
}
