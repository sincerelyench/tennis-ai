import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  COACH_DISPLAY_NAME_ZH,
  COACH_LIBRARY_STROKES,
  emptyLibrary,
  isStrokeId,
  type CoachStrokeEntry,
  type CoachStrokeLibrary,
} from "@/lib/coach-stroke-library";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "coach-library.json");

async function readStore(): Promise<Record<string, CoachStrokeLibrary>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, CoachStrokeLibrary>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function coachIdFromRequest(req: NextRequest): string {
  const q = req.nextUrl.searchParams.get("coachId");
  if (q && q.trim()) return q.trim();
  // Default roster id used by the live app (display name is 涨球教练).
  return "poppy";
}

export async function GET(req: NextRequest) {
  try {
    const coachId = coachIdFromRequest(req);
    const store = await readStore();
    const lib = store[coachId] || emptyLibrary(coachId);
    lib.coachName = COACH_DISPLAY_NAME_ZH;
    const stroke = req.nextUrl.searchParams.get("strokeId");
    if (stroke) {
      if (!isStrokeId(stroke)) {
        return NextResponse.json({ error: "Unknown stroke" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        coachId,
        coachName: COACH_DISPLAY_NAME_ZH,
        strokes: COACH_LIBRARY_STROKES,
        entry: lib.entries[stroke] || null,
        library: lib,
      });
    }
    return NextResponse.json({
      ok: true,
      coachId,
      coachName: COACH_DISPLAY_NAME_ZH,
      strokes: COACH_LIBRARY_STROKES,
      library: lib,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load coach library", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const coachId = coachIdFromRequest(req);
    const body = await req.json();
    const strokeId = String(body?.strokeId || "");
    if (!isStrokeId(strokeId)) {
      return NextResponse.json({ error: "Unknown stroke" }, { status: 400 });
    }
    const store = await readStore();
    const lib = store[coachId] || emptyLibrary(coachId);
    const prev = lib.entries[strokeId];
    const entry: CoachStrokeEntry = {
      strokeId,
      prompt: String(body?.prompt ?? prev?.prompt ?? "").slice(0, 8000),
      videoUrl: String(body?.videoUrl ?? prev?.videoUrl ?? "").slice(0, 4000),
      title: String(body?.title ?? prev?.title ?? "").slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    lib.entries[strokeId] = entry;
    lib.coachName = COACH_DISPLAY_NAME_ZH;
    lib.updatedAt = entry.updatedAt;
    store[coachId] = lib;
    await writeStore(store);
    return NextResponse.json({ ok: true, entry, library: lib, coachName: COACH_DISPLAY_NAME_ZH });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save coach library", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const coachId = coachIdFromRequest(req);
    const strokeId = req.nextUrl.searchParams.get("strokeId") || "";
    if (!isStrokeId(strokeId)) {
      return NextResponse.json({ error: "Unknown stroke" }, { status: 400 });
    }
    const store = await readStore();
    const lib = store[coachId] || emptyLibrary(coachId);
    delete lib.entries[strokeId];
    lib.updatedAt = new Date().toISOString();
    store[coachId] = lib;
    await writeStore(store);
    return NextResponse.json({ ok: true, library: lib });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete entry", detail: String(err) },
      { status: 500 },
    );
  }
}
