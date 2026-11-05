import { translate, type Locale } from "@/lib/i18n/translate";

export const CLIP_MIN_SEC = 10;
export const CLIP_MAX_SEC = 10;
export const CLIP_ABS_MIN_SEC = 0.2;

export function clipLength(start: number, end: number) {
  return Math.round((end - start) * 100) / 100;
}

export function isShortSource(duration: number) {
  return Number.isFinite(duration) && duration >= CLIP_ABS_MIN_SEC && duration < CLIP_MIN_SEC;
}

export function isValidClip(start: number, end: number, duration: number) {
  if (!Number.isFinite(duration) || duration < CLIP_ABS_MIN_SEC) return false;
  if (start < -0.02 || end > duration + 0.05) return false;
  const length = end - start;
  if (isShortSource(duration)) {
    return start <= 0.05 && Math.abs(end - duration) <= 0.08;
  }
  return length >= CLIP_MIN_SEC - 0.02 && length <= CLIP_MAX_SEC + 0.02;
}

export function defaultClipRange(duration: number) {
  if (!Number.isFinite(duration) || duration < CLIP_ABS_MIN_SEC) return null;
  if (isShortSource(duration)) {
    return { start: 0, end: Math.round(duration * 100) / 100 };
  }
  return { start: 0, end: CLIP_MAX_SEC };
}

export function moveClipWindow(start: number, end: number, duration: number, deltaSec: number) {
  if (isShortSource(duration)) return { start: 0, end: Math.round(duration * 100) / 100 };
  const length = Math.min(CLIP_MAX_SEC, Math.max(CLIP_MIN_SEC, end - start));
  const nextStart = start + deltaSec;
  return clampClip(nextStart, nextStart + length, duration);
}

export function clampClip(start: number, end: number, duration: number) {
  const safeDuration = Math.max(0, duration);
  if (safeDuration < CLIP_MIN_SEC) {
    return { start: 0, end: Math.round(safeDuration * 100) / 100 };
  }
  let nextStart = Math.min(Math.max(0, start), Math.max(0, safeDuration - CLIP_MIN_SEC));
  let nextEnd = Math.min(safeDuration, Math.max(nextStart + CLIP_MIN_SEC, end));
  if (nextEnd - nextStart > CLIP_MAX_SEC) {
    nextEnd = nextStart + CLIP_MAX_SEC;
  }
  if (nextEnd > safeDuration) {
    nextEnd = safeDuration;
    nextStart = Math.max(0, nextEnd - CLIP_MAX_SEC);
  }
  return {
    start: Math.round(nextStart * 100) / 100,
    end: Math.round(nextEnd * 100) / 100,
  };
}

export function formatClipTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

export function clipHint(start: number, end: number, duration: number, locale: Locale = "en") {
  if (!Number.isFinite(duration) || duration < CLIP_ABS_MIN_SEC) {
    return translate(locale, "trim.notLoaded");
  }
  if (isShortSource(duration)) {
    return translate(locale, "trim.fullClip", { time: formatClipTime(duration) });
  }
  const length = end - start;
  if (length < CLIP_MIN_SEC) return translate(locale, "trim.needTen");
  if (length > CLIP_MAX_SEC) return translate(locale, "trim.onlyTen");
  return translate(locale, "trim.selectedOk", { time: formatClipTime(length) });
}
