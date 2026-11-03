/**
 * 涨球球友 · 王者荣耀式附近匹配
 * 按城市优先 + 类 UTR / 自评水平接近度挑一位合适球友。
 */

import {
  rateLadder,
  utrSeedFromSelfLevel,
  playersFromDirectory,
  ensureSelfInPlayers,
  type LadderFormat,
  type LadderPlayer,
  type LadderRow,
} from "@/lib/local-ladder";

export const SELF_LEVEL_KEY = "zq-friends-self-level-v1";
export const SELF_NAME_KEY = "zq-friends-self-name-v1";

export const LEVEL_OPTIONS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as const;

export type MatchPhase = "idle" | "searching" | "found" | "empty";

export type MatchCandidate = {
  id: string;
  name: string;
  cityId: string;
  ntrp: number;
  rating: number;
  rank: number;
  wins: number;
  losses: number;
  /** lower is better */
  score: number;
  utrDelta: number;
  levelDelta: number;
  sameCity: boolean;
  reasonKey: "sameCityClose" | "sameCityOk" | "nearbyClose" | "nearbyOk";
};

export type SelfProfile = {
  name: string;
  level: number;
  cityId: string;
  utr: number;
};

export function loadSelfLevel(fallback = 3.5): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SELF_LEVEL_KEY);
    const n = Number(raw);
    if (LEVEL_OPTIONS.includes(n as (typeof LEVEL_OPTIONS)[number])) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function persistSelfLevel(level: number) {
  try {
    localStorage.setItem(SELF_LEVEL_KEY, String(level));
  } catch {
    /* ignore */
  }
}

export function loadSelfName(fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(SELF_NAME_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function persistSelfName(name: string) {
  try {
    localStorage.setItem(SELF_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Nearby city affinity for soft fallback when same-city pool is thin. */
const NEARBY: Record<string, string[]> = {
  wuxi: ["suzhou", "shanghai", "nanjing", "hangzhou"],
  suzhou: ["wuxi", "shanghai", "hangzhou", "nanjing"],
  shanghai: ["suzhou", "wuxi", "hangzhou", "ningbo"],
  hangzhou: ["shanghai", "ningbo", "suzhou", "nanjing"],
  nanjing: ["wuxi", "suzhou", "hefei", "hangzhou"],
  beijing: ["tianjin"],
  tianjin: ["beijing"],
  guangzhou: ["shenzhen", "dongguan"],
  shenzhen: ["guangzhou", "dongguan", "hongkong"],
  dongguan: ["guangzhou", "shenzhen"],
  hongkong: ["shenzhen", "guangzhou"],
  chengdu: ["chongqing"],
  chongqing: ["chengdu"],
  wuhan: ["changsha", "hefei"],
  changsha: ["wuhan"],
  xian: ["zhengzhou"],
  zhengzhou: ["xian", "hefei"],
  hefei: ["nanjing", "wuhan", "zhengzhou"],
  ningbo: ["hangzhou", "shanghai"],
  qingdao: ["beijing", "tianjin"],
  xiamen: ["guangzhou", "shenzhen"],
  taipei: ["xiamen", "hongkong"],
  newyork: ["toronto"],
  toronto: ["newyork"],
  london: ["paris", "berlin"],
  paris: ["london", "berlin"],
  berlin: ["london", "paris"],
  tokyo: ["seoul"],
  seoul: ["tokyo"],
  singapore: ["bangkok"],
  bangkok: ["singapore"],
  sydney: ["singapore"],
  dubai: ["bangkok"],
  losangeles: ["newyork"],
};

function cityDistance(selfCity: string, otherCity: string): number {
  if (selfCity === otherCity) return 0;
  const near = NEARBY[selfCity] || [];
  const idx = near.indexOf(otherCity);
  if (idx >= 0) return 1 + idx * 0.15;
  return 3.5;
}

function reasonFor(sameCity: boolean, utrDelta: number): MatchCandidate["reasonKey"] {
  if (sameCity && utrDelta <= 0.5) return "sameCityClose";
  if (sameCity) return "sameCityOk";
  if (utrDelta <= 0.5) return "nearbyClose";
  return "nearbyOk";
}

/**
 * Rank candidates like a casual MOBA matchmaker:
 * same city first, then UTR/level proximity, tiny jitter so rematch isn't identical.
 */
export function findMatchCandidates(
  self: SelfProfile,
  format: LadderFormat = "singles",
  excludeIds: string[] = [],
  jitter = Math.random(),
  directoryPlayers: LadderPlayer[] = [],
  selfId?: string | null,
): MatchCandidate[] {
  // Only real auth directory players — empty directory ⇒ empty match pool (count 0).
  // Self may be on the local ladder, but never a matchmaking buddy.
  const players = directoryPlayers.length ? directoryPlayers : [];
  const sameCityRows = rateLadder(format, new Date(), players, [], self.cityId);
  const nearbyIds = NEARBY[self.cityId] || [];
  const nearbyRows: LadderRow[] = [];
  for (const cid of nearbyIds.slice(0, 3)) {
    nearbyRows.push(...rateLadder(format, new Date(), players, [], cid));
  }

  const seen = new Set<string>(excludeIds);
  const selfKey = String(selfId || "").trim();
  if (selfKey) seen.add(selfKey);
  const selfName = String(self.name || "").trim();
  if (selfName) {
    for (const row of [...sameCityRows, ...nearbyRows]) {
      if (row.name === selfName) seen.add(row.id);
    }
  }
  const pool: LadderRow[] = [];
  for (const row of [...sameCityRows, ...nearbyRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    pool.push(row);
  }

  const selfUtr = self.utr || utrSeedFromSelfLevel(self.level);
  const scored: MatchCandidate[] = pool.map((row) => {
    const utrDelta = Math.abs(row.rating - selfUtr);
    const levelDelta = Math.abs(row.ntrp - self.level);
    const sameCity = row.cityId === self.cityId;
    const dist = cityDistance(self.cityId, row.cityId);
    // Weights tuned for “fair nearby buddy” feel
    const score =
      dist * 2.2 +
      utrDelta * 1.8 +
      levelDelta * 0.9 +
      (row.played ? 0 : 0.25) +
      ((jitter * 17 + row.rank * 3) % 7) * 0.04;
    return {
      id: row.id,
      name: row.name,
      cityId: row.cityId,
      ntrp: row.ntrp,
      rating: row.rating,
      rank: row.rank,
      wins: row.wins,
      losses: row.losses,
      score,
      utrDelta: Math.round(utrDelta * 10) / 10,
      levelDelta: Math.round(levelDelta * 10) / 10,
      sameCity,
      reasonKey: reasonFor(sameCity, utrDelta),
    };
  });

  scored.sort((a, b) => a.score - b.score || a.utrDelta - b.utrDelta || a.name.localeCompare(b.name));
  return scored;
}

export function pickBestMatch(
  self: SelfProfile,
  format: LadderFormat = "singles",
  excludeIds: string[] = [],
  directoryPlayers: LadderPlayer[] = [],
  selfId?: string | null,
): MatchCandidate | null {
  const list = findMatchCandidates(
    self,
    format,
    excludeIds,
    Math.random(),
    directoryPlayers,
    selfId,
  );
  return list[0] || null;
}

export { playersFromDirectory, ensureSelfInPlayers };

/** Simulated search delay (Honor-of-Kings feel), 1.6–2.8s. */
export function matchSearchMs(): number {
  return 1600 + Math.floor(Math.random() * 1200);
}
