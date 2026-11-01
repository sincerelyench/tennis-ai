/**
 * Resolve chat persona for 涨球教练 (built-in) vs published network coaches.
 * Display brand is always 涨球教练 — never Poppy / 东东 / 掌球教练.
 */

import { findCoach, DEFAULT_COACH_ID } from "@/lib/coach-roster";
import { normalizeDisplayName, DEFAULT_COACH_NAME_ZH, DEFAULT_COACH_NAME_EN } from "@/lib/coach-publish";
import { getProfile, listPublished } from "@/lib/coach-publish-store";
import { promises as fs } from "fs";
import path from "path";

export const ZHANGQIU_COACH_ID = DEFAULT_COACH_ID; // legacy storage id "poppy"
export const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";

export type Locale = "zh" | "en";

export function isBuiltInZhangqiu(coachId?: string | null): boolean {
  const id = String(coachId || "").trim().toLowerCase();
  return !id || id === "poppy" || id === "zhangqiu" || id === ZHANGQIU_COACH_ID;
}

export function zhangqiuDisplayName(locale: Locale = "zh"): string {
  return locale === "en" ? DEFAULT_COACH_NAME_EN : DEFAULT_COACH_NAME_ZH;
}

type LibraryEntry = { prompt?: string; title?: string; strokeId?: string };
type LibraryFile = Record<string, { entries?: Record<string, LibraryEntry> }>;

async function readLibraryPrompts(coachId: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".data", "coach-library.json"), "utf8");
    const store = JSON.parse(raw) as LibraryFile;
    const entries = store?.[coachId]?.entries || {};
    const out: string[] = [];
    for (const e of Object.values(entries)) {
      const prompt = String(e?.prompt || "").trim();
      if (prompt) out.push(prompt.slice(0, 280));
    }
    return out.slice(0, 6);
  } catch {
    return [];
  }
}

/** Built-in 涨球教练 persona from roster (never expose Poppy). */
export function builtInZhangqiuPersona(locale: Locale = "zh"): string {
  const roster = findCoach(ZHANGQIU_COACH_ID)?.persona;
  if (roster) return roster;
  return locale === "zh"
    ? "你是涨球教练。短句边线提示，一次只改一个击球点。不要自称 Poppy 或东东。"
    : "You are Zhangqiu Coach. Short sideline cues, one contact fix at a time. Never call yourself Poppy.";
}

/**
 * Network coach persona from published profile + library prompts.
 * Returns null if coachId is built-in or not a published coach.
 */
export async function resolveNetworkCoachPersona(
  coachId: string | undefined,
  locale: Locale = "zh",
): Promise<{ coachId: string; displayName: string; persona: string } | null> {
  if (isBuiltInZhangqiu(coachId)) return null;
  const id = String(coachId || "").trim();
  if (!id) return null;

  const published = await listPublished();
  const match = published.find((p) => p.coachId === id) || null;
  const profile = match || (await getProfile(id));
  if (profile.status !== "published" && !match) return null;

  const displayName = normalizeDisplayName(profile.displayName) || zhangqiuDisplayName(locale);
  const style = String(profile.styleTagline || "").trim();
  const prompts = await readLibraryPrompts(id);
  const cueLines = prompts.length
    ? prompts.map((p, i) => `${i + 1}. ${p}`).join(" ")
    : locale === "zh"
      ? "先强调击球点在身前，再谈力量与随挥。"
      : "Meet the ball out front before power; finish the swing.";

  const persona =
    locale === "zh"
      ? `你是网络教练「${displayName}」，在涨球 App 里与球员问答聊天。风格：${style || "务实、短句、一次一个要点"}。可参考你动作库讲解：${cueLines}。回答用简体中文。不要自称 Poppy、东东或掌球教练。你不是涨球教练本人，但同属涨球平台。`
      : `You are network coach "${displayName}" chatting with a player inside the Zhangqiu app. Style: ${style || "practical, short cues, one fix at a time"}. Library cues: ${cueLines}. Reply in American English only. Never call yourself Poppy. You are not Zhangqiu Coach, but you coach on the Zhangqiu platform.`;

  return { coachId: id, displayName, persona };
}

export async function resolveChatPersona(
  coachId: string | undefined,
  locale: Locale = "zh",
): Promise<{ coachId: string; displayName: string; persona: string; kind: "zhangqiu" | "network" }> {
  const network = await resolveNetworkCoachPersona(coachId, locale);
  if (network) return { ...network, kind: "network" };
  return {
    coachId: ZHANGQIU_COACH_ID,
    displayName: zhangqiuDisplayName(locale),
    persona: builtInZhangqiuPersona(locale),
    kind: "zhangqiu",
  };
}
