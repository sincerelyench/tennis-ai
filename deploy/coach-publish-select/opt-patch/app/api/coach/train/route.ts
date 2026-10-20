import { NextRequest, NextResponse } from "next/server";
import {
  canSubmitTrain,
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  statusLabel,
  submitForTraining,
} from "@/lib/coach-publish";
import { countLibraryStrokes, getProfile, saveProfile } from "@/lib/coach-publish-store";

export const runtime = "nodejs";

function coachIdFrom(req: NextRequest, body?: { coachId?: string }): string {
  const q = req.nextUrl.searchParams.get("coachId");
  if (q?.trim()) return q.trim();
  if (body?.coachId?.trim()) return body.coachId.trim();
  return DEFAULT_COACH_ID;
}

/** GET — poll train / publish status (advances stub job). */
export async function GET(req: NextRequest) {
  try {
    const coachId = coachIdFrom(req);
    const profile = await getProfile(coachId);
    return NextResponse.json({
      ok: true,
      profile,
      trainJob: profile.trainJob,
      coachName: profile.displayName || DEFAULT_COACH_NAME_ZH,
      statusLabelZh: statusLabel(profile.status, "zh"),
      statusLabelEn: statusLabel(profile.status, "en"),
      stub: true,
      note: "Training is a stub job status. Wire real GPU train here later.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load train status", detail: String(err) },
      { status: 500 },
    );
  }
}

/** POST — enqueue style training from coach library material. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const coachId = coachIdFrom(req, body);
    let profile = await getProfile(coachId);
    const libraryStrokeCount =
      typeof body?.libraryStrokeCount === "number"
        ? body.libraryStrokeCount
        : await countLibraryStrokes(coachId);
    profile.libraryStrokeCount = libraryStrokeCount;

    if (libraryStrokeCount <= 0) {
      return NextResponse.json(
        { error: "Library is empty — save at least one stroke before training" },
        { status: 400 },
      );
    }
    if (!canSubmitTrain(profile)) {
      return NextResponse.json(
        { error: "Cannot submit for training in current status", status: profile.status },
        { status: 409 },
      );
    }

    if (body?.displayName) {
      profile.displayName = String(body.displayName);
    }
    if (body?.styleTagline != null) {
      profile.styleTagline = String(body.styleTagline).slice(0, 200);
    }

    profile = submitForTraining(profile, libraryStrokeCount);
    profile = await saveProfile(profile);

    return NextResponse.json({
      ok: true,
      profile,
      trainJob: profile.trainJob,
      coachName: profile.displayName || DEFAULT_COACH_NAME_ZH,
      statusLabelZh: statusLabel(profile.status, "zh"),
      statusLabelEn: statusLabel(profile.status, "en"),
      stub: true,
      note: "Enqueued stub training. Poll GET /api/coach/train or /api/coach/publish until ready.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to enqueue training", detail: String(err) },
      { status: 500 },
    );
  }
}
