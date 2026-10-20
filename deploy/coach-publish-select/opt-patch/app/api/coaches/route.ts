import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_COACH_NAME_ZH, normalizeDisplayName } from "@/lib/coach-publish";
import { getProfile, listPublished } from "@/lib/coach-publish-store";

export const runtime = "nodejs";

/**
 * GET /api/coaches?published=1 — list coaches players may select.
 * GET /api/coaches?coachId=… — one profile (any status; for coach workspace).
 */
export async function GET(req: NextRequest) {
  try {
    const coachId = req.nextUrl.searchParams.get("coachId");
    if (coachId?.trim()) {
      const profile = await getProfile(coachId.trim());
      return NextResponse.json({
        ok: true,
        coach: {
          coachId: profile.coachId,
          displayName: normalizeDisplayName(profile.displayName) || DEFAULT_COACH_NAME_ZH,
          styleTagline: profile.styleTagline,
          status: profile.status,
          publishedAt: profile.publishedAt,
          libraryStrokeCount: profile.libraryStrokeCount,
        },
        profile,
      });
    }

    const publishedOnly = req.nextUrl.searchParams.get("published") !== "0";
    const list = publishedOnly ? await listPublished() : [];
    const coaches = list.map((p) => ({
      coachId: p.coachId,
      displayName: normalizeDisplayName(p.displayName) || DEFAULT_COACH_NAME_ZH,
      styleTagline: p.styleTagline,
      publishedAt: p.publishedAt,
      libraryStrokeCount: p.libraryStrokeCount,
    }));

    return NextResponse.json({
      ok: true,
      coaches,
      empty: coaches.length === 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to list coaches", detail: String(err) },
      { status: 500 },
    );
  }
}
