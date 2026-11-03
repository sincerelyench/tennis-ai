import { translate, type Locale } from "@/lib/i18n/translate";

/** Minimum selectable window when source is long enough. */
export const CLIP_MIN_SEC = 10;
/** Default window length on open. */
export const CLIP_DEFAULT_SEC = 10;
/**
 * Soft upper bound kept for older call sites. Effective max is always the
 * source duration (user may drag longer than the default 10s).
 */
export const CLIP_MAX_SEC = Number.POSITIVE_INFINITY;
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
  return length >= CLIP_MIN_SEC - 0.02;
}

export function defaultClipRange(duration: number) {
  if (!Number.isFinite(duration) || duration < CLIP_ABS_MIN_SEC) return null;
  if (isShortSource(duration)) {
    return { start: 0, end: Math.round(duration * 100) / 100 };
  }
  return { start: 0, end: Math.min(duration, CLIP_DEFAULT_SEC) };
}

export function moveClipWindow(start: number, end: number, duration: number, deltaSec: number) {
  if (isShortSource(duration)) return { start: 0, end: Math.round(duration * 100) / 100 };
  const length = Math.min(duration, Math.max(CLIP_MIN_SEC, end - start));
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
  if (nextEnd - nextStart < CLIP_MIN_SEC) {
    if (nextStart + CLIP_MIN_SEC <= safeDuration) {
      nextEnd = nextStart + CLIP_MIN_SEC;
    } else {
      nextEnd = safeDuration;
      nextStart = Math.max(0, nextEnd - CLIP_MIN_SEC);
    }
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
  return translate(locale, "trim.selectedOk", { time: formatClipTime(length) });
}
