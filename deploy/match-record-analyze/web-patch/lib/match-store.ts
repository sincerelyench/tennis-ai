"use client";

import { useSyncExternalStore } from "react";
import { buildDemoMatch, type MatchRecord } from "@/lib/match-demo";

const KEY = "zq-match-records-v1";
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
  } catch {
    /* ignore quota */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as MatchRecord[];
    if (Array.isArray(parsed)) matches = parsed;
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
  matches = [match, ...matches.filter((m) => m.id !== match.id)].slice(0, 40);
  persist();
  emit();
  return match;
}

export function deleteMatch(id: string) {
  hydrate();
  matches = matches.filter((m) => m.id !== id);
  persist();
  emit();
}

export function ensureDemoMatch(): MatchRecord {
  hydrate();
  if (matches.length) return matches[0];
  const demo = buildDemoMatch({ title: "涨球演示赛 · SwingVision 向", seed: 1083 });
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
