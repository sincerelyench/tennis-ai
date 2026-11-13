/** Public Android APK already hosted for releases (nginx → /var/www/apk/tennis-ai.apk). */
export const ANDROID_APK_URL = "https://yqchen.blog/tennis-ai.apk";

export const APK_HINT_DISMISS_KEY = "zq-apk-hint-dismissed-v1";

/** True when running inside the signed 涨球 Android WebView shell. */
export function isZhangqiuAndroidShell(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /ZhangqiuAndroid/i.test(ua || "");
}

/**
 * Soft download hint audience: Android phone browser / generic WebView,
 * not iOS, not desktop, not already inside the native APK shell.
 */
export function shouldSuggestAndroidApk(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  const raw = ua || "";
  if (!raw) return false;
  if (isZhangqiuAndroidShell(raw)) return false;
  if (/ZhangqiuIOS|iPhone|iPad|iPod/i.test(raw)) return false;
  if (!/Android/i.test(raw)) return false;
  // Prefer phones; skip obvious tablets without Mobile token.
  if (/Mobile/i.test(raw)) return true;
  if (/Tablet|Pad|Nexus 7|Nexus 9|Nexus 10|SM-T/i.test(raw)) return false;
  return true;
}

export function readApkHintDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(APK_HINT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeApkHintDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APK_HINT_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}
