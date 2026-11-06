import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from "mediabunny";
import { CLIP_ABS_MIN_SEC, CLIP_MAX_SEC, CLIP_MIN_SEC, isShortSource, isValidClip } from "@/lib/clip";
import { MIN_PLAYABLE_BYTES, clipTooThin, pickFatterClip } from "@/lib/clip-quality";

function withTimeout<T>(work: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function measureBlobDuration(file: Blob) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const duration = await input.computeDuration();
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Can't read this video's duration");
  }
  return duration;
}

export async function remuxClip(file: Blob, start: number, end: number, name: string) {
  return withTimeout(remuxClipNow(file, start, end, name), 120000, "error.trimTimeout");
}

async function remuxClipNow(file: Blob, start: number, end: number, name: string) {
  const sourceDuration = await measureBlobDuration(file);
  if (!isValidClip(start, end, sourceDuration)) {
    throw new Error(isShortSource(sourceDuration) ? "Submit this short clip as-is." : "Select a 10-second clip first.");
  }
  // Copy-first: sequential copy+transcode doubled phone remux time and felt like a hang
  // before POST even started. Prefer a valid copy; only transcode when copy fails.
  const copied = await convertClip(file, start, end, name, false).catch(() => null);
  if (copied) return copied;
  const transcoded = await convertClip(file, start, end, name, true).catch(() => null);
  const picked = pickFatterClip([copied, transcoded]);
  if (picked) return picked;
  const whole = Math.abs(start) < 0.05 && Math.abs(end - sourceDuration) < 0.25;
  if (whole && !clipTooThin(file.size, sourceDuration)) {
    return new File([file], clipName(name), { type: file.type || "video/mp4" });
  }
  throw new Error("This clip has no picture after convert. Trim a common MP4 instead.");
}

async function convertClip(file: Blob, start: number, end: number, name: string, transcode: boolean) {
  const requested = Math.max(0, end - start);
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    audio: { discard: true },
    trim: { start, end },
    copy: transcode ? false : {},
    video: transcode
      ? { codec: "avc", quality: QUALITY_HIGH, keyFrameInterval: 2 }
      : undefined,
    showWarnings: false,
  });
  if (!conversion.isValid) {
    throw new Error("This video can't be trimmed. Use a common MP4.");
  }
  await conversion.execute();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < MIN_PLAYABLE_BYTES) {
    throw new Error("The trimmed clip is empty. Trim it again.");
  }
  const clip = new File([buffer], clipName(name), { type: "video/mp4" });
  let duration = 0;
  try {
    duration = await measureBlobDuration(clip);
  } catch {
    throw new Error("The trimmed clip won't open. Trim a different MP4.");
  }
  if (duration < CLIP_ABS_MIN_SEC) {
    throw new Error("The trimmed clip is empty. Trim it again.");
  }
  // Keyframe copy can overrun the window. Fail this path so the other
  // convert mode (usually transcode) can retry — do not hard-cap at 20s,
  // because CLIP_MAX_SEC is the source duration (user may drag past 10s).
  if (requested > 0.5 && duration > Math.max(requested + 8, requested * 1.8)) {
    throw new Error(`The clip is ${duration.toFixed(2)} seconds. Trim again.`);
  }
  if (requested >= CLIP_MIN_SEC - 0.02 && duration < 3) {
    throw new Error(`The clip is only ${duration.toFixed(2)} seconds. Analysis needs about 10 seconds.`);
  }
  if (clipTooThin(clip.size, duration)) {
    throw new Error("The trimmed clip has no picture.");
  }
  if (duration < CLIP_MIN_SEC - 2 || duration > CLIP_MAX_SEC + 2) {
    // Keyframe copy can miss a bit; still send it so analysis can run.
  }
  return clip;
}

export async function toAvcMp4(file: Blob, name = "clip.mp4") {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    audio: { discard: true },
    copy: false,
    video: { codec: "avc", quality: QUALITY_HIGH, keyFrameInterval: 2 },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    throw new Error("This video can't be converted to a playable MP4.");
  }
  await conversion.execute();
  const buffer = target.buffer;
  if (!buffer || clipTooThin(buffer.byteLength)) {
    throw new Error("The converted clip is empty.");
  }
  return new File([buffer], clipName(name), { type: "video/mp4" });
}

function clipName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "clip";
  return `${base}-clip.mp4`;
}
