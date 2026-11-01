import { requireSession } from "@/lib/algo";
import {
  coachLocale,
  fallbackCoachResponse,
  openingUserPrompt,
  parseCoachPayload,
  resolvePhase,
  type ChatMessage,
  type CoachPhase,
  type CoachRequest,
} from "@/lib/coach";
import { json, preflight } from "@/lib/auth-http";
import { harmonixChat } from "@/lib/harmonix";
import { resolveChatPersona } from "@/lib/network-coach-persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function buildSystemPrompt(phase: CoachPhase, persona: string, locale: "zh" | "en") {
  const language =
    locale === "zh"
      ? "Reply only in Simplified Chinese. Every user-facing string in text, improvePlan, and tasks must be Simplified Chinese. Do not use English chrome."
      : "Reply only in American English. Every user-facing string in text, improvePlan, and tasks must be English. Do not use Chinese.";
  const shared = [
    language,
    persona,
    "Do not invent analysis scores. Do not talk about dating.",
    "Each task covers only one item: forehand, backhand, serve, or footwork.",
    "Demo clips are public web pages attached by the system. Do not write video links, and do not ask the user to download videos.",
    "Output only one JSON object, no markdown. Fields: text, dailyPlan, improvePlan, tasks.",
    "dailyPlan / improvePlan look like {title, summary, items: string[]}.",
    "tasks look like [{id, title, detail, skill}]. skill must be forehand|backhand|serve|footwork.",
  ];

  if (phase === "improve" || phase === "daily") {
    return [
      ...shared,
      "Only confirm the improvement plan. Fold the week's schedule into it: which days, how long, and two or three things to change.",
      "Do not use a separate daily plan. dailyPlan must be null. improvePlan is required. tasks must be [].",
      "Ask the user to confirm. Until they confirm, do not list current tasks.",
    ].join(" ");
  }

  // phase === "coaching" (tasks unlocked)
  return [
    ...shared,
    "The improvement plan is confirmed. Break it into current tasks, one action per item.",
    "tasks need at least 3 items among forehand, backhand, serve, or footwork.",
    "Stay on the confirmed plan. dailyPlan must be null.",
  ].join(" ");
}

export async function POST(request: Request) {
  const gate = requireSession(request);
  if (gate.error) return gate.error;

  const body = (await request.json().catch(() => null)) as CoachRequest | null;
  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages: ChatMessage[] = incoming
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && item.content?.trim())
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 4000) }))
    .slice(-20);

  const confirmedDaily = Boolean(body?.confirmedDaily);
  const confirmedImprove = Boolean(body?.confirmedImprove);
  const locale = coachLocale(body?.locale);
  const phase = resolvePhase(confirmedDaily, confirmedImprove);
  const resolved = await resolveChatPersona(body?.coachId, locale);

  if (messages.length === 0) {
    messages.push({ role: "user", content: openingUserPrompt(phase, locale) });
  }

  try {
    const system = buildSystemPrompt(phase, resolved.persona, locale);
    const raw = await harmonixChat(system, messages);
    const payload = parseCoachPayload(raw, phase, locale);
    return json(request, {
      ...payload,
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
    });
  } catch {
    return json(request, {
      ...fallbackCoachResponse(phase, locale),
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
    });
  }
}
