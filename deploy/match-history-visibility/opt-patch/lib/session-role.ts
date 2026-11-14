"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { UserRole } from "@/lib/role";

type SessionState = {
  phone: string;
  role: UserRole;
  displayName: string;
  cityId: string;
  wechatId: string;
  /** ZQ-139 · 战绩可见; default true = 全局可见. */
  matchHistoryPublic: boolean;
  level: number | null;
  /**
   * Missing display name and/or WeChat ID (约球 required).
   * Always false until /api/auth/session hydrates.
   */
  needsProfileSetup: boolean;
  hydrated: boolean;
};

const ROLE_KEY = "tennis-ai-role";
const NAME_KEY = "tennis-ai-display-name";
const CITY_KEY = "zq-friends-city-v1";
const WECHAT_KEY = "tennis-ai-wechat-id";
const COMPLETE_KEY = "tennis-ai-profile-complete-v1";
const listeners = new Set<() => void>();

function readStoredRole(): UserRole {
  if (typeof window === "undefined") return "player";
  try {
    const saved = window.localStorage.getItem(ROLE_KEY);
    if (saved === "coach" || saved === "player") return saved;
  } catch {
    /* ignore */
  }
  return "player";
}

function readStoredName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function readStoredCity(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(CITY_KEY) || "").trim();
  } catch {
    return "";
  }
}

function readStoredWechat(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(WECHAT_KEY) || "").trim();
  } catch {
    return "";
  }
}

function writeCompleteFlag(complete: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (complete) window.localStorage.setItem(COMPLETE_KEY, "1");
    else window.localStorage.removeItem(COMPLETE_KEY);
  } catch {
    /* ignore */
  }
}

function readCompleteFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 约球-required: display name + WeChat ID (city alone never). */
export function profileNeedsSetup(displayName: string, wechatId?: string) {
  return !String(displayName || "").trim() || !String(wechatId || "").trim();
}

let session: SessionState = {
  phone: "",
  role: readStoredRole(),
  displayName: readStoredName(),
  cityId: readStoredCity(),
  wechatId: readStoredWechat(),
  matchHistoryPublic: true,
  level: null,
  needsProfileSetup: false,
  hydrated: false,
};
let loaded = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persistClient(next: SessionState) {
  try {
    window.localStorage.setItem(ROLE_KEY, next.role);
    if (next.displayName) window.localStorage.setItem(NAME_KEY, next.displayName);
    else window.localStorage.removeItem(NAME_KEY);
    if (next.displayName) {
      window.localStorage.setItem("zq-friends-self-name-v1", next.displayName);
    }
    if (next.cityId) window.localStorage.setItem(CITY_KEY, next.cityId);
    if (next.wechatId) window.localStorage.setItem(WECHAT_KEY, next.wechatId);
    else window.localStorage.removeItem(WECHAT_KEY);
    writeCompleteFlag(
      Boolean(next.phone) && !profileNeedsSetup(next.displayName, next.wechatId),
    );
  } catch {
    /* ignore */
  }
}

function applySessionPayload(payload: {
  phone?: string;
  role?: UserRole;
  displayName?: string;
  cityId?: string;
  wechatId?: string;
  matchHistoryPublic?: boolean;
  level?: number | null;
  needsProfileSetup?: boolean;
}) {
  const displayName = String(payload.displayName || "").trim();
  const cityId = String(payload.cityId || "").trim();
  const wechatId = String(payload.wechatId || "").trim();
  const phone = payload.phone || "";
  const computed = Boolean(phone) && profileNeedsSetup(displayName, wechatId);
  const needs =
    typeof payload.needsProfileSetup === "boolean"
      ? payload.needsProfileSetup
      : computed;
  session = {
    phone,
    role: payload.role || session.role || "player",
    displayName,
    cityId,
    wechatId,
    matchHistoryPublic: payload.matchHistoryPublic !== false,
    level: typeof payload.level === "number" ? payload.level : null,
    needsProfileSetup: needs,
    hydrated: true,
  };
  persistClient(session);
  emit();
}

export function useSessionRole() {
  useEffect(() => {
    if (loaded) return;
    loaded = true;
    void (async () => {
      try {
        const response = await fetch("/tennis/api/auth/session", { credentials: "include" });
        const payload = (await response.json()) as {
          phone?: string;
          role?: UserRole;
          displayName?: string;
          cityId?: string;
          wechatId?: string;
          matchHistoryPublic?: boolean;
          level?: number | null;
          needsProfileSetup?: boolean;
        };
        if (response.ok && payload.role) {
          applySessionPayload(payload);
          return;
        }
      } catch {
        /* keep defaults */
      }
      writeCompleteFlag(false);
      session = {
        ...session,
        phone: "",
        needsProfileSetup: false,
        hydrated: true,
      };
      emit();
    })();
  }, []);
  return useSyncExternalStore(subscribe, () => session, () => session);
}

export async function refreshSessionProfile() {
  try {
    const response = await fetch("/tennis/api/auth/session", { credentials: "include" });
    const payload = (await response.json()) as {
      phone?: string;
      role?: UserRole;
      displayName?: string;
      cityId?: string;
      wechatId?: string;
      matchHistoryPublic?: boolean;
      level?: number | null;
      needsProfileSetup?: boolean;
    };
    if (response.ok && payload.role) {
      applySessionPayload(payload);
      return session;
    }
  } catch {
    /* ignore */
  }
  session = { ...session, hydrated: true };
  emit();
  return session;
}

export function hasCachedCompleteProfile() {
  return readCompleteFlag();
}

export function isCoachRole(role?: UserRole | null) {
  return role === "coach";
}
