import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  normalizeDisplayName,
} from "@/lib/coach-publish";
import { getPlayerCoach, getProfile, listPublished, setPlayerCoach } from "@/lib/coach-publish-store";

export const runtime = "nodejs";

function playerIdFrom(req: NextRequest, body?: { playerId?: string }): string {
  const q = req.nextUrl.searchParams.get("playerId");
  if (q?.trim()) return q.trim();
  if (body?.playerId?.trim()) return body.playerId.trim();
  // Anonymous / cookie-less local: single shared bucket is fine for stub.
  return "player_local";
}

export async function GET(req: NextRequest) {
  try {
    const playerId = playerIdFrom(req);
    const coachId = await getPlayerCoach(playerId);
    const published = await listPublished();
    const match = published.find((p) => p.coachId === coachId) || null;
    const profile = match || (await getProfile(coachId));
    const coach =
      profile.status === "published"
        ? {
            coachId: profile.coachId,
            displayName: normalizeDisplayName(profile.displayName) || DEFAULT_COACH_NAME_ZH,
            styleTagline: profile.styleTagline,
            publishedAt: profile.publishedAt,
            libraryStrokeCount: profile.libraryStrokeCount,
          }
        : null;

    return NextResponse.json({
      ok: true,
      playerId,
      coachId: coach ? coach.coachId : DEFAULT_COACH_ID,
      coach,
      // If selected coach unpublished, UI should prompt re-pick.
      needsReselect: !coach && published.length > 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load selected coach", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = playerIdFrom(req, body);
    const coachId = String(body?.coachId || "").trim();
    if (!coachId) {
      return NextResponse.json({ error: "coachId required" }, { status: 400 });
    }

    const published = await listPublished();
    const match = published.find((p) => p.coachId === coachId);
    if (!match) {
      return NextResponse.json(
        { error: "Coach is not published", coachId },
        { status: 409 },
      );
    }

    await setPlayerCoach(playerId, coachId);
    return NextResponse.json({
      ok: true,
      playerId,
      coachId,
      coach: {
        coachId: match.coachId,
        displayName: normalizeDisplayName(match.displayName) || DEFAULT_COACH_NAME_ZH,
        styleTagline: match.styleTagline,
        publishedAt: match.publishedAt,
        libraryStrokeCount: match.libraryStrokeCount,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to select coach", detail: String(err) },
      { status: 500 },
    );
  }
}
