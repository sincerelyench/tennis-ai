import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  COACH_DISPLAY_NAME_ZH,
  emptyLibrary,
  isStrokeId,
  type CoachStrokeEntry,
  type CoachStrokeLibrary,
} from "@/lib/coach-stroke-library";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "coach-library.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "coach-demos");

const MAX_BYTES = 80 * 1024 * 1024; // 80MB
const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime", "application/octet-stream"]);

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const strokeId = String(form.get("strokeId") || "");
    const coachId = String(form.get("coachId") || "poppy");
    const title = String(form.get("title") || "");
    const prompt = form.get("prompt");
    const file = form.get("video") || form.get("file");

    if (!isStrokeId(strokeId)) {
      return NextResponse.json({ error: "Unknown stroke" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Video too large or empty (max 80MB)" }, { status: 400 });
    }
    const type = file.type || "application/octet-stream";
    if (!ALLOWED.has(type) && !/\.(mp4|webm|mov)$/i.test(file.name || "")) {
      return NextResponse.json({ error: "Use mp4 / webm / mov" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = (file.name && path.extname(file.name)) || ".mp4";
    const safeExt = /^\.(mp4|webm|mov)$/i.test(ext) ? ext.toLowerCase() : ".mp4";
    const filename = `${coachId}-${strokeId}-${Date.now()}${safeExt}`;
    const abs = path.join(UPLOAD_DIR, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buf);

    // basePath /tennis → public URL
    const videoUrl = `/tennis/coach-demos/${filename}`;

    const store = await readStore();
    const lib = store[coachId] || emptyLibrary(coachId);
    const prev = lib.entries[strokeId];
    const entry: CoachStrokeEntry = {
      strokeId,
      prompt: String(prompt ?? prev?.prompt ?? "").slice(0, 8000),
      videoUrl,
      title: (title || prev?.title || "").slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    lib.entries[strokeId] = entry;
    lib.coachName = COACH_DISPLAY_NAME_ZH;
    lib.updatedAt = entry.updatedAt;
    store[coachId] = lib;
    await writeStore(store);

    return NextResponse.json({
      ok: true,
      entry,
      library: lib,
      coachName: COACH_DISPLAY_NAME_ZH,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload failed", detail: String(err) },
      { status: 500 },
    );
  }
}
