/**
 * Server-side JSON store for coach publish profiles.
 * File: .data/coach-publish.json
 */

import { promises as fs } from "fs";
import path from "path";
import {
  advanceTrainJob,
  emptyProfile,
  normalizeDisplayName,
  type CoachPublishProfile,
} from "@/lib/coach-publish";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "coach-publish.json");
const PLAYER_FILE = path.join(DATA_DIR, "player-selected-coach.json");

export async function readPublishStore(): Promise<Record<string, CoachPublishProfile>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writePublishStore(store: Record<string, CoachPublishProfile>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getProfile(coachId: string): Promise<CoachPublishProfile> {
  const store = await readPublishStore();
  const base = store[coachId] || emptyProfile(coachId);
  const advanced = advanceTrainJob({
    ...emptyProfile(coachId),
    ...base,
    coachId,
    displayName: normalizeDisplayName(base.displayName),
  });
  if (
    store[coachId] &&
    (advanced.status !== store[coachId].status ||
      advanced.trainJob?.progress !== store[coachId].trainJob?.progress)
  ) {
    store[coachId] = advanced;
    await writePublishStore(store);
  }
  return advanced;
}

export async function saveProfile(profile: CoachPublishProfile): Promise<CoachPublishProfile> {
  const store = await readPublishStore();
  const next = advanceTrainJob({
    ...profile,
    displayName: normalizeDisplayName(profile.displayName),
    updatedAt: new Date().toISOString(),
  });
  store[next.coachId] = next;
  await writePublishStore(store);
  return next;
}

export async function listPublished(): Promise<CoachPublishProfile[]> {
  const store = await readPublishStore();
  const out: CoachPublishProfile[] = [];
  let dirty = false;
  for (const [id, raw] of Object.entries(store)) {
    const p = advanceTrainJob({
      ...emptyProfile(id),
      ...raw,
      coachId: id,
      displayName: normalizeDisplayName(raw.displayName),
    });
    if (
      store[id].status !== p.status ||
      store[id].trainJob?.progress !== p.trainJob?.progress
    ) {
      store[id] = p;
      dirty = true;
    }
    if (p.status === "published") out.push(p);
  }
  if (dirty) await writePublishStore(store);
  return out.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

type PlayerMap = Record<string, string>;

async function readPlayerMap(): Promise<PlayerMap> {
  try {
    const raw = await fs.readFile(PLAYER_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writePlayerMap(map: PlayerMap) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PLAYER_FILE, JSON.stringify(map, null, 2), "utf8");
}

export async function getPlayerCoach(playerId: string): Promise<string> {
  const map = await readPlayerMap();
  return map[playerId] || "poppy";
}

export async function setPlayerCoach(playerId: string, coachId: string): Promise<string> {
  const map = await readPlayerMap();
  map[playerId] = coachId;
  await writePlayerMap(map);
  return coachId;
}

/** Best-effort count of filled strokes from sibling coach-library.json. */
export async function countLibraryStrokes(coachId: string): Promise<number> {
  try {
    const libFile = path.join(DATA_DIR, "coach-library.json");
    const raw = await fs.readFile(libFile, "utf8");
    const store = JSON.parse(raw);
    const lib = store?.[coachId];
    if (!lib?.entries || typeof lib.entries !== "object") return 0;
    let n = 0;
    for (const e of Object.values(lib.entries) as Array<{ prompt?: string; videoUrl?: string }>) {
      if ((e?.prompt || "").trim() || (e?.videoUrl || "").trim()) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}
