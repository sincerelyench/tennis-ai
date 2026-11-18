/**
 * H5 (web-view) helper: ask the native mini-program shell to show
 * wx.requestSubscribeMessage via navigateTo(/pages/subscribe/…).
 * No-op outside WeChat mini program.
 */
export type MpSubscribeEvent =
  | "ladder"
  | "invite"
  | "invite_accepted"
  | "score_confirm"
  | "message";

declare global {
  interface Window {
    wx?: {
      miniProgram?: {
        navigateTo?: (opts: { url: string }) => void;
        getEnv?: (cb: (res: { miniprogram?: boolean }) => void) => void;
      };
    };
    __wxjs_environment?: string;
  }
}

export function isWeChatMiniProgram(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__wxjs_environment === "miniprogram") return true;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return /miniProgram/i.test(ua) || /MicroMessenger/i.test(ua);
}

/**
 * Navigate to native subscribe page. Safe to call before invite/accept/score/message.
 * Does not await the WeChat sheet (web-view cannot); user returns to web afterwards.
 */
export function requestMpSubscribe(events: MpSubscribeEvent[], opts?: { next?: string }) {
  if (typeof window === "undefined") return false;
  const list = Array.from(new Set(events.filter(Boolean)));
  if (!list.length) return false;
  const next = opts?.next || (typeof window !== "undefined" ? window.location.pathname : "/");
  const url =
    "/pages/subscribe/subscribe?events=" +
    encodeURIComponent(list.join(",")) +
    "&next=" +
    encodeURIComponent(next.startsWith("/") ? next : `/${next}`);

  const mp = window.wx?.miniProgram;
  if (mp && typeof mp.navigateTo === "function") {
    try {
      mp.navigateTo({ url });
      return true;
    } catch {
      /* fall through */
    }
  }
  return false;
}

/** Convenience: invite flow (recipient needs invite tmpl; sender may need accepted later). */
export function requestSubscribeBeforeInvite() {
  return requestMpSubscribe(["invite", "invite_accepted", "message"], {
    next: "/friends",
  });
}

export function requestSubscribeBeforeAccept() {
  return requestMpSubscribe(["invite_accepted", "message", "score_confirm"], {
    next: "/notices",
  });
}

export function requestSubscribeBeforeScore() {
  return requestMpSubscribe(["score_confirm", "ladder", "message"], {
    next: "/friends",
  });
}

export function requestSubscribeBeforeMessage() {
  return requestMpSubscribe(["message"], { next: "/notices" });
}
