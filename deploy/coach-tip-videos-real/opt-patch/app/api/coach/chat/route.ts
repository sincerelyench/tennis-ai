import { requireSession } from "@/lib/algo";
import {
  fallbackCoachResponse,
  openingUserPrompt,
  parseCoachPayload,
  resolveCoachLocale,
  resolvePhase,
  videoForSkill,
  videosForSkill,
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

function isFreeformGoal(text: string) {
  return (
    /提高|提升|改进|想要|希望|球速|力量|稳定|一致性|耐力|信心/i.test(text) &&
    !/想学|教我|带我练|要点|要领|分步|章节/.test(text)
  );
}

function inferVideoSkill(text: string): string {
  const blob = String(text || "");
  if (/球速|速度|加速|更快|力量|发力|转速|拍头速度/i.test(blob)) {
    if (/发球|一发|二发|serve/i.test(blob)) return "serve";
    if (/反手|backhand/i.test(blob)) return "bh-topspin";
    return "fh-topspin";
  }
  if (/步法|移动|到位|分腿|footwork/i.test(blob)) return "footwork";
  if (/发球|serve/i.test(blob)) return "serve";
  if (/反手|backhand/i.test(blob)) return "bh-topspin";
  if (/正手|forehand|上旋/i.test(blob)) return "fh-topspin";
  return "fh-topspin";
}

function buildSystemPrompt(
  phase: CoachPhase,
  persona: string,
  locale: "zh" | "en",
  drill: CoachDrill | null,
  kind: "zhangqiu" | "network",
  freeform: boolean,
) {
  const language =
    locale === "zh"
      ? "Reply only in Simplified Chinese. Every user-facing string in text, improvePlan, and drill must be Simplified Chinese. Do not mix English words, English UI chrome, or English channel names into the reply."
      : "Reply only in American English. Every user-facing string in text, improvePlan, and drill must be English. Do not use Chinese.";
  const shared = [
    language,
    persona,
    "Do not invent analysis scores. Do not talk about dating.",
    "Do not mention 当前任务 / current tasks. There is no current-task concept — only the improvement plan and practical advice.",
    "Real platform lesson videos (Bilibili / Xiaohongshu / YouTube) are attached by the system as 视频讲解. Do not paste raw video URLs; you may say a lesson video is attached. Never refer to local demo or placeholder clips.",
    "Output only one JSON object, no markdown. Fields: text, dailyPlan, improvePlan, tasks, drill, suggestVideoSkill.",
    "dailyPlan / improvePlan look like {title, summary, items: string[]}.",
    "tasks must always be [] (current tasks removed from product).",
    "suggestVideoSkill should be one of fh-topspin|bh-topspin|fh-slice|bh-slice|fh-volley|bh-volley|serve|smash|footwork when a 视频讲解 helps.",
  ];

  if (kind === "zhangqiu" && drill && !freeform) {
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

  if (freeform && kind === "zhangqiu") {
    shared.push(
      locale === "zh"
        ? "用户在说自己的泛化目标（如提高球速、力量、稳定性），请给正常实用建议：2～4 条可上场做的要点即可。不要套用八项技术要领的分步章节模板，不要输出 drill。suggestVideoSkill 必填，方便系统附上视频讲解（中文会附小红书+B站）。并告诉用户看什么、怎么练。"
        : "The user stated a freeform goal (e.g. more ball speed). Give practical on-court advice in 2–4 bullets. Do NOT force the eight-technique chapter drill template; drill must be null. Always set suggestVideoSkill so the client can attach a YouTube lesson. Tell them what to watch and how to practice.",
    );
  }

  // Dialogue coaching is the primary mode — freeform answers + video lessons.
  // improvePlan is optional and never required for the UI tabs.
  return [
    ...shared,
    "You are in dialogue coaching mode. Answer the user's tennis question directly with practical advice.",
    "dailyPlan must be null. improvePlan may be null unless the user explicitly asks for a weekly plan.",
    "tasks must be []. Prefer suggestVideoSkill whenever a demo helps.",
    locale === "zh"
      ? "中文回复末尾可提示：下面附上匹配的视频讲解，先看再练。"
      : "You may mention that a matching video lesson is attached below.",
    drill && !freeform
      ? "User is learning a stroke now: walk through the drill phases and set suggestVideoSkill."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
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
  // Peek user text before locale so Chinese tips never fall through to YouTube/demo.
  const peekUser = latestUserText(messages);
  const locale = resolveCoachLocale({
    bodyLocale: body?.locale,
    cookieHeader: request.headers.get("cookie"),
    acceptLanguage: request.headers.get("accept-language"),
    userText: peekUser,
  });
  const phase = resolvePhase(confirmedDaily, confirmedImprove);
  const resolved = await resolveChatPersona(body?.coachId, locale);

  if (messages.length === 0) {
    messages.push({ role: "user", content: openingUserPrompt(phase, locale) });
  }

  const lastUser = latestUserText(messages);
  const freeform = isFreeformGoal(lastUser);
  const intentId =
    !freeform && resolved.kind === "zhangqiu" && isBuiltInZhangqiu(resolved.coachId)
      ? resolveTechniqueIntent(lastUser)
      : null;
  const drill = intentId ? buildCoachDrill(intentId, locale === "zh" ? "zh" : "en") : null;

  // Deterministic drill reply for 涨球教练 when the user clearly asks to learn a stroke.
  const learnNow =
    drill &&
    /想学|学习|教我|带我练|练习|练一下|怎么打|如何打|要点|要领|learn|practice|teach|drill|how (do|to)/i.test(lastUser);

  function attachVideos(skill: string) {
    // Chinese user text → Bilibili + Xiaohongshu only (never local /examples mp4).
    const list = videosForSkill(skill, locale);
    return {
      suggestVideoSkill: skill,
      videoSuggestion: list[0] || videoForSkill(skill, locale),
      videoSuggestions: list,
    };
  }

  if (learnNow && drill && resolved.kind === "zhangqiu") {
    try {
      const system = buildSystemPrompt(phase, resolved.persona, locale, drill, resolved.kind, false);
      const raw = await harmonixChat(system, messages);
      const payload = parseCoachPayload(raw, phase, locale, drill);
      return json(request, {
        ...payload,
        text: payload.text || drillOpeningText(drill, locale === "zh" ? "zh" : "en"),
        tasks: [],
        drill,
        coachId: resolved.coachId,
        coachName: resolved.displayName,
        coachKind: resolved.kind,
        ...attachVideos(drill.strokeId),
      });
    } catch {
      return json(request, {
        ...fallbackCoachResponse(phase, locale, drill),
        text: drillOpeningText(drill, locale === "zh" ? "zh" : "en"),
        tasks: [],
        drill,
        coachId: resolved.coachId,
        coachName: resolved.displayName,
        coachKind: resolved.kind,
        ...attachVideos(drill.strokeId),
      });
    }
  }

  try {
    const system = buildSystemPrompt(phase, resolved.persona, locale, drill, resolved.kind, freeform);
    const raw = await harmonixChat(system, messages);
    const payload = parseCoachPayload(raw, phase, locale, freeform ? null : drill);
    const skill =
      (typeof (payload as { suggestVideoSkill?: string }).suggestVideoSkill === "string" &&
        (payload as { suggestVideoSkill?: string }).suggestVideoSkill) ||
      inferVideoSkill(lastUser || payload.text);
    return json(request, {
      ...payload,
      tasks: [],
      drill: freeform ? null : payload.drill,
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
      ...(skill ? attachVideos(skill) : { videoSuggestion: null, videoSuggestions: [] }),
    });
  } catch {
    const skill = inferVideoSkill(lastUser);
    return json(request, {
      ...fallbackCoachResponse(phase, locale, freeform ? null : drill),
      tasks: [],
      drill: freeform ? null : drill,
      coachId: resolved.coachId,
      coachName: resolved.displayName,
      coachKind: resolved.kind,
      ...(skill ? attachVideos(skill) : { videoSuggestion: null, videoSuggestions: [] }),
    });
  }
}
