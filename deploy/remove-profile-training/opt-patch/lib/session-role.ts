"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { UserRole } from "@/lib/role";

type SessionState = {
  phone: string;
  role: UserRole;
  displayName: string;
  cityId: string;
  level: number | null;
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

let session: SessionState = {
  phone: "",
  role: readStoredRole(),
  displayName: readStoredName(),
  cityId: "",
  level: null,
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
        };
        if (response.ok && payload.role) {
          session = {
            phone: payload.phone || "",
            role: payload.role,
            displayName: String(payload.displayName || "").trim(),
            cityId: String(payload.cityId || "").trim(),
            level: typeof payload.level === "number" ? payload.level : null,
          };
          persistClient(session);
          emit();
        }
      } catch {
        /* keep defaults */
      }
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
    };
    if (response.ok && payload.role) {
      session = {
        phone: payload.phone || "",
        role: payload.role,
        displayName: String(payload.displayName || "").trim(),
        cityId: String(payload.cityId || "").trim(),
        level: typeof payload.level === "number" ? payload.level : null,
      };
      persistClient(session);
      emit();
    }
  } catch {
    /* ignore */
  }
  return session;
}

export function isCoachRole(role?: UserRole | null) {
  return role === "coach";
}
