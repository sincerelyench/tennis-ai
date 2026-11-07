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
import { resolveChatPersona, isBuiltInZhangqiu } from "@/lib/network-coach-persona";
import {
  buildCoachDrill,
  drillGuideSystemRules,
  drillOpeningText,
  resolveTechniqueIntent,
  techniquePromptBlock,
  type CoachDrill,
} from "@/lib/eight-techniques";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function latestUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content || "";
  }
  return "";
}

function buildSystemPrompt(
  phase: CoachPhase,
  persona: string,
  locale: "zh" | "en",
  drill: CoachDrill | null,
  kind: "zhangqiu" | "network",
) {
  const language =
    locale === "zh"
      ? "Reply only in Simplified Chinese. Every user-facing string in text, improvePlan, tasks, and drill must be Simplified Chinese. Do not use English chrome."
      : "Reply only in American English. Every user-facing string in text, improvePlan, tasks, and drill must be English. Do not use Chinese.";
  const shared = [
    language,
    persona,
    "Do not invent analysis scores. Do not talk about dating.",
    "Demo clips are public web pages attached by the system. Do not write video links, and do not ask the user to download videos.",
    "Output only one JSON object, no markdown. Fields: text, dailyPlan, improvePlan, tasks, drill.",
    "dailyPlan / improvePlan look like {title, summary, items: string[]}.",
    "tasks look like [{id, title, detail, skill}]. Prefer skill fh-topspin|bh-topspin|fh-slice|bh-slice|fh-volley|bh-volley|serve|smash|footwork.",
  ];

  if (kind === "zhangqiu" && drill) {
    shared.push(drillGuideSystemRules(locale, drill));
    shared.push("Canon section for this drill (do not paraphrase away detail):\n" + techniquePromptBlock(drill.strokeId, locale));
    shared.push(
      `Attach this exact drill object in JSON (cues unchanged): ${JSON.stringify({
        strokeId: drill.strokeId,
        title: drill.title,
        summary: drill.summary,
        steps: drill.steps,
      })}`,
    );
  }

  if (phase === "improve" || phase === "daily") {
    return [
      ...shared,
      "Only confirm the improvement plan. Fold the week's schedule into it: which days, how long, and two or three things to change.",
      "Do not use a separate daily plan. dailyPlan must be null. improvePlan is required. tasks must be [].",
      "Ask the user to confirm. Until they confirm, do not list current tasks.",
      drill
        ? "User is learning a stroke now: improvePlan should align to this stroke's drill phases; still ask for plan confirm."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    ...shared,
    "The improvement plan is confirmed. Break it into current tasks, one action per item.",
    "tasks need at least 3 items among the eight techniques or footwork.",
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

  const intentId =
    resolved.kind === "zhangqiu" && isBuiltInZhangqiu(resolved.coachId)
      ? resolveTechniqueIntent(latestUserText(messages))
      : null;
  const drill = intentId ? buildCoachDrill(intentId, locale === "zh" ? "zh" : "en") : null;

  // Deterministic drill reply for 涨球教练 when the user clearly asks to learn a stroke.
  // Keeps practice on the eight-technique canon even if the LLM is down.
  const learnNow =
    drill &&
    /想学|学习|教我|带我练|练习|练一下|怎么打|如何打|要点|要领|learn|practice|teach|drill|how (do|to)/i.test(
      latestUserText(messages),
    );

  if (learnNow && drill && resolved.kind === "zhangqiu") {
    try {
      const system = buildSystemPrompt(phase, resolved.persona, locale, drill, resolved.kind);
      const raw = await harmonixChat(system, messages);
      const payload = parseCoachPayload(raw, phase, locale, drill);
      return json(request, {
        ...payload,
        text: payload.text || drillOpeningText(drill, locale === "zh" ? "zh" : "en"),
        drill,
        coachId: resolved.coachId,
        coachName: resolved.displayName,
        coachKind: resolved.kind,
      });
    } catch {
      return json(request, {
        ...fallbackCoachResponse(phase, locale, drill),
        text: drillOpeningText(drill, locale === "zh" ? "zh" : "en"),
        drill,
        coachId: resolved.coachId,
        coachName: resolved.displayName,
        coachKind: resolved.kind,
      });
    }
  }

  try {
    const system = buildSystemPrompt(phase, resolved.persona, locale, drill, resolved.kind);
    const raw = await harmonixChat(system, messages);
    const payload = parseCoachPayload(raw, phase, locale, drill);
    return json(request, {
      ...payload,
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
    });
  } catch {
    return json(request, {
      ...fallbackCoachResponse(phase, locale, drill),
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
    });
  }
}
