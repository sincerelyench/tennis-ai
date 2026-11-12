"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { UserRole } from "@/lib/role";

type SessionState = {
  phone: string;
  role: UserRole;
  displayName: string;
  cityId: string;
  level: number | null;
  /** Server/client-unified: missing display name only (city alone is not enough). */
  needsProfileSetup: boolean;
  /** True after the first /api/auth/session attempt finishes (ok or fail). */
  hydrated: boolean;
};

const ROLE_KEY = "tennis-ai-role";
const NAME_KEY = "tennis-ai-display-name";
const CITY_KEY = "zq-friends-city-v1";
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

function missingDisplayName(name: string | null | undefined) {
  return !String(name || "").trim();
}

let session: SessionState = {
  phone: "",
  role: readStoredRole(),
  displayName: readStoredName(),
  cityId: "",
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
    if (next.cityId) {
      window.localStorage.setItem(CITY_KEY, next.cityId);
    }
  } catch {
    /* ignore */
  }
}

function applySessionPayload(payload: {
  phone?: string;
  role?: UserRole;
  displayName?: string;
  cityId?: string;
  level?: number | null;
  needsProfileSetup?: boolean;
}) {
  const displayName = String(payload.displayName || "").trim();
  const cityId = String(payload.cityId || "").trim();
  const phone = payload.phone || "";
  const needs =
    typeof payload.needsProfileSetup === "boolean"
      ? payload.needsProfileSetup
      : Boolean(phone) && missingDisplayName(displayName);
  session = {
    phone,
    role: payload.role || session.role || "player",
    displayName,
    cityId,
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
          level?: number | null;
          needsProfileSetup?: boolean;
          error?: string;
        };
        if (response.ok && payload.role) {
          applySessionPayload(payload);
          return;
        }
      } catch {
        /* keep defaults */
      }
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
  session = {
    ...session,
    hydrated: true,
  };
  emit();
  return session;
}

export function isCoachRole(role?: UserRole | null) {
  return role === "coach";
}
