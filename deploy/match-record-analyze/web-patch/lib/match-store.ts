"use client";

import { useSyncExternalStore } from "react";
import { buildDemoMatch, type MatchRecord } from "@/lib/match-demo";

/** Bump clears cached demos that still carried 「SwingVision 向」 titles / old landings. */
const KEY = "zq-match-records-v2";
const LEGACY_KEYS = ["zq-match-records-v1"];

export function scrubMatchTitle(title: string | undefined): string {
  let s = String(title || "");
  s = s.replace(/SwingVision\s*向?/gi, "").replace(/swing\s*vision/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[·\s\-—|]+|[·\s\-—|]+$/g, "").trim();
  return s || "涨球演示赛";
}

const listeners = new Set<() => void>();
let matches: MatchRecord[] = [];
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(matches));
    for (const k of LEGACY_KEYS) window.localStorage.removeItem(k);
  } catch {
    /* ignore quota */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    let raw = window.localStorage.getItem(KEY);
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        raw = window.localStorage.getItem(k);
        if (raw) break;
      }
    }
    if (!raw) return;
    const parsed = JSON.parse(raw) as MatchRecord[];
    if (Array.isArray(parsed)) {
      matches = parsed.map((m) => ({ ...m, title: scrubMatchTitle(m.title) }));
      // Drop demos that still encode SwingVision in any string field after scrub miss.
      matches = matches.filter((m) => !/swing\s*vision/i.test(JSON.stringify(m)));
      persist();
    }
  } catch {
    matches = [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    queueMicrotask(() => {
      const before = matches;
      hydrate();
      if (matches !== before) emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useMatchRecords() {
  return useSyncExternalStore(subscribe, () => matches, () => matches);
}

export function getMatchById(id: string): MatchRecord | null {
  hydrate();
  return matches.find((m) => m.id === id) || null;
}

export function saveMatch(match: MatchRecord) {
  hydrate();
  const cleaned = { ...match, title: scrubMatchTitle(match.title) };
  matches = [cleaned, ...matches.filter((m) => m.id !== cleaned.id)].slice(0, 40);
  persist();
  emit();
  return cleaned;
}

export function deleteMatch(id: string) {
  hydrate();
  matches = matches.filter((m) => m.id !== id);
  persist();
  emit();
}

export function ensureDemoMatch(): MatchRecord {
  hydrate();
  const existing = matches.find((m) => m.pipeline === "demo") || matches[0];
  if (existing) {
    const title = scrubMatchTitle(existing.title);
    if (title !== existing.title) {
      const fixed = { ...existing, title };
      saveMatch(fixed);
      return fixed;
    }
    return existing;
  }
  const demo = buildDemoMatch({ title: "涨球演示赛", seed: 1083 });
  saveMatch(demo);
  return demo;
}

export function createMatchFromOptions(opts: {
  format: "singles" | "doubles";
  mode: "standard" | "ground";
  title?: string;
}): MatchRecord {
  const match = buildDemoMatch({
    format: opts.format,
    mode: opts.mode,
    title: opts.title,
    seed: Date.now() % 1_000_000,
  });
  saveMatch(match);
  return match;
}
