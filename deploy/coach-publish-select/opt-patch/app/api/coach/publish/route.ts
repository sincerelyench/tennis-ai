import { NextRequest, NextResponse } from "next/server";
import {
  acceptPublish,
  canRequestPublish,
  canWithdraw,
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  rejectPublish,
  requestPublish,
  statusLabel,
  withdraw,
} from "@/lib/coach-publish";
import { countLibraryStrokes, getProfile, saveProfile } from "@/lib/coach-publish-store";

export const runtime = "nodejs";

function coachIdFrom(req: NextRequest, body?: { coachId?: string }): string {
  const q = req.nextUrl.searchParams.get("coachId");
  if (q?.trim()) return q.trim();
  if (body?.coachId?.trim()) return body.coachId.trim();
  return DEFAULT_COACH_ID;
}

export async function GET(req: NextRequest) {
  try {
    const coachId = coachIdFrom(req);
    const profile = await getProfile(coachId);
    const libraryStrokeCount = await countLibraryStrokes(coachId);
    if (libraryStrokeCount !== profile.libraryStrokeCount) {
      profile.libraryStrokeCount = libraryStrokeCount;
      await saveProfile(profile);
    }
    return NextResponse.json({
      ok: true,
      profile,
      coachName: profile.displayName || DEFAULT_COACH_NAME_ZH,
      statusLabelZh: statusLabel(profile.status, "zh"),
      statusLabelEn: statusLabel(profile.status, "en"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load publish status", detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST body:
 *   { action: "request" | "withdraw" | "accept" | "reject", displayName?, styleTagline?, reason?, autoAccept? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const coachId = coachIdFrom(req, body);
    const action = String(body?.action || "");
    let profile = await getProfile(coachId);
    const libraryStrokeCount = await countLibraryStrokes(coachId);
    profile.libraryStrokeCount = libraryStrokeCount;

    if (action === "request") {
      if (!canRequestPublish(profile)) {
        return NextResponse.json(
          { error: "Not ready to publish", status: profile.status },
          { status: 409 },
        );
      }
      profile = requestPublish(profile, {
        displayName: body?.displayName,
        styleTagline: body?.styleTagline,
        autoAccept: body?.autoAccept !== false,
      });
    } else if (action === "accept") {
      // Platform accept stub (admin / opt-in path).
      if (profile.status !== "pending_review" && profile.status !== "ready") {
        return NextResponse.json(
          { error: "Nothing to accept", status: profile.status },
          { status: 409 },
        );
      }
      profile = acceptPublish(profile);
    } else if (action === "reject") {
      profile = rejectPublish(profile, body?.reason || "Platform rejected");
    } else if (action === "withdraw") {
      if (!canWithdraw(profile)) {
        return NextResponse.json(
          { error: "Nothing to withdraw", status: profile.status },
          { status: 409 },
        );
      }
      profile = withdraw(profile);
    } else {
      return NextResponse.json(
        { error: "Unknown action. Use request | withdraw | accept | reject" },
        { status: 400 },
      );
    }

    profile = await saveProfile(profile);
    return NextResponse.json({
      ok: true,
      profile,
      coachName: profile.displayName || DEFAULT_COACH_NAME_ZH,
      statusLabelZh: statusLabel(profile.status, "zh"),
      statusLabelEn: statusLabel(profile.status, "en"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update publish status", detail: String(err) },
      { status: 500 },
    );
  }
}
