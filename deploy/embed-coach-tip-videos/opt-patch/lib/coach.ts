import { findCoach } from "@/lib/coach-roster";
import { isLocale, translate, type Locale } from "@/lib/i18n/translate";
import {
  buildCoachDrill,
  type CoachDrill,
  type TechniqueId,
  isTechniqueId,
} from "@/lib/eight-techniques";

export type CoachPhase = "daily" | "improve" | "coaching";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type CoachTask = {
  id: string;
  title: string;
  detail: string;
  skill: ExampleSkill;
  video: ExampleVideo;
};

export type CoachPlan = {
  title: string;
  summary: string;
  items: string[];
};

export type ExampleSkill = "forehand" | "backhand" | "serve" | "footwork" | TechniqueId;

export type VideoPlatform = "youtube" | "bilibili" | "xiaohongshu";

export type ExampleVideo = {
  skill: ExampleSkill;
  title: string;
  channel: string;
  url: string;
  embedUrl: string;
  notes: string;
  /** Where the lesson lives. zh → bilibili/xiaohongshu; en → youtube. */
  platform?: VideoPlatform;
  /** How to practice after watching. */
  practiceTip?: string;
  /**
   * Native tip clip (mp4) for inline playback when the platform has no iframe
   * (Xiaohongshu) or as a reliable fallback beside Bilibili/YouTube embeds.
   */
  videoSrc?: string;
};

function biliEmbed(bvid: string, page = 1): string {
  return `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&danmaku=0&autoplay=0`;
}

function biliWatch(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}/`;
}

/** Hosted short tip clips — playable inline (no third-party search). */
const TIP_CLIPS: Record<"forehand" | "backhand" | "serve" | "footwork", string> = {
  forehand: "/tennis/examples/forehand-topspin.mp4",
  backhand: "/tennis/examples/backhand-topspin.mp4",
  serve: "/tennis/examples/serve.mp4",
  footwork: "/tennis/examples/forehand-volley.mp4",
};

/** English: YouTube demos. */
const YOUTUBE_META: Record<
  "forehand" | "backhand" | "serve" | "footwork",
  {
    channel: string;
    url: string;
    embedUrl: string;
    titleKey: string;
    notesKey: string;
    practiceEn: string;
  }
> = {
  forehand: {
    channel: "Essential Tennis",
    url: "https://www.youtube.com/watch?v=r9VroI2sNzI",
    embedUrl: "https://www.youtube-nocookie.com/embed/r9VroI2sNzI",
    titleKey: "coach.videoFhTitle",
    notesKey: "coach.videoFhNotes",
    practiceEn: "Watch the swing path once, then do 20 slow feeds meeting the ball farther in front.",
  },
  backhand: {
    channel: "Top Tennis Training",
    url: "https://www.youtube.com/watch?v=i1k8MLOsOwI",
    embedUrl: "https://www.youtube-nocookie.com/embed/i1k8MLOsOwI",
    titleKey: "coach.videoBhTitle",
    notesKey: "coach.videoBhNotes",
    practiceEn: "Turn the shoulders first, then send. Film a side view of 15 shadow swings.",
  },
  serve: {
    channel: "Top Tennis Training",
    url: "https://www.youtube.com/watch?v=6998O764rKU",
    embedUrl: "https://www.youtube-nocookie.com/embed/6998O764rKU",
    titleKey: "coach.videoSvTitle",
    notesKey: "coach.videoSvNotes",
    practiceEn: "Three tosses, then one swing. Hold the trophy pose a beat before accelerating.",
  },
  footwork: {
    channel: "Top Tennis Training",
    url: "https://www.youtube.com/watch?v=J1UhPl1UrYs",
    embedUrl: "https://www.youtube-nocookie.com/embed/J1UhPl1UrYs",
    titleKey: "coach.videoFtTitle",
    notesKey: "coach.videoFtNotes",
    practiceEn: "Split-step on every bounce. Practice 10 recovery steps to the center mark.",
  },
};

/**
 * Chinese: curated playable lessons.
 * - Bilibili → official player iframe (bvid)
 * - Xiaohongshu → hosted short tip mp4 (XHS has no public iframe; still labeled 小红书短讲解)
 * Never send users to a search page to find the lesson themselves.
 */
const ZH_VIDEO_META: Record<
  "forehand" | "backhand" | "serve" | "footwork",
  {
    title: string;
    practiceTip: string;
    bilibili: { channel: string; url: string; embedUrl: string; notes: string; videoSrc?: string };
    xiaohongshu: { channel: string; url: string; embedUrl: string; notes: string; videoSrc: string };
  }
> = {
  forehand: {
    title: "正手上旋讲解",
    practiceTip: "先看完整挥拍路径，再上场慢喂 20 个：击球点再往身前送一个拍头。",
    bilibili: {
      channel: "B站 · 网球正手",
      url: biliWatch("BV1sp411d7Ww"),
      embedUrl: biliEmbed("BV1sp411d7Ww"),
      notes: "对照握拍、击球点与随挥。可直接在下方播放。",
      videoSrc: TIP_CLIPS.forehand,
    },
    xiaohongshu: {
      channel: "小红书 · 正手讲解",
      url: TIP_CLIPS.forehand,
      embedUrl: TIP_CLIPS.forehand,
      videoSrc: TIP_CLIPS.forehand,
      notes: "短视频讲解：重点看击球点与转肩。可直接播放。",
    },
  },
  backhand: {
    title: "反手上旋讲解",
    practiceTip: "先转身再送拍。侧面录 15 次影子挥拍，检查非持拍手引导。",
    bilibili: {
      channel: "B站 · 网球反手",
      url: biliWatch("BV1na1YBzELQ"),
      embedUrl: biliEmbed("BV1na1YBzELQ"),
      notes: "对照转肩与击球点。可直接在下方播放。",
      videoSrc: TIP_CLIPS.backhand,
    },
    xiaohongshu: {
      channel: "小红书 · 反手讲解",
      url: TIP_CLIPS.backhand,
      embedUrl: TIP_CLIPS.backhand,
      videoSrc: TIP_CLIPS.backhand,
      notes: "短视频讲解：重点看准备与随挥。可直接播放。",
    },
  },
  serve: {
    title: "发球讲解",
    practiceTip: "先抛三次再挥一次；奖杯姿势多停一拍再加速。",
    bilibili: {
      channel: "B站 · 网球发球",
      url: biliWatch("BV1b5411U7D2"),
      embedUrl: biliEmbed("BV1b5411U7D2"),
      notes: "对照抛球与奖杯姿势。可直接在下方播放。",
      videoSrc: TIP_CLIPS.serve,
    },
    xiaohongshu: {
      channel: "小红书 · 发球讲解",
      url: TIP_CLIPS.serve,
      embedUrl: TIP_CLIPS.serve,
      videoSrc: TIP_CLIPS.serve,
      notes: "短视频讲解：重点看抛球落点。可直接播放。",
    },
  },
  footwork: {
    title: "步法讲解",
    practiceTip: "每次来球分腿垫步；练 10 次回位到中线。",
    bilibili: {
      channel: "B站 · 网球步法",
      url: biliWatch("BV12f421Z7Wn"),
      embedUrl: biliEmbed("BV12f421Z7Wn", 5),
      notes: "对照分腿垫步时机与落地。可直接在下方播放。",
      videoSrc: TIP_CLIPS.footwork,
    },
    xiaohongshu: {
      channel: "小红书 · 步法讲解",
      url: TIP_CLIPS.footwork,
      embedUrl: TIP_CLIPS.footwork,
      videoSrc: TIP_CLIPS.footwork,
      notes: "短视频讲解：重点看分腿垫步节奏。可直接播放。",
    },
  },
};

function videoSkillKey(skill: string): keyof typeof YOUTUBE_META {
  if (skill === "backhand" || skill === "bh-topspin" || skill === "bh-slice" || skill === "bh-volley") {
    return "backhand";
  }
  if (skill === "serve" || skill === "smash") return "serve";
  if (skill === "footwork") return "footwork";
  return "forehand";
}

/** Best-matching lesson for locale: zh → Bilibili primary; en → YouTube. */
export function videoForSkill(skill: string, locale: Locale = "en"): ExampleVideo {
  const key = videoSkillKey(skill);
  const skillId = isTechniqueId(skill) ? skill : key;
  if (locale === "zh") {
    const meta = ZH_VIDEO_META[key];
    return {
      skill: skillId,
      title: meta.title,
      channel: meta.bilibili.channel,
      url: meta.bilibili.url,
      embedUrl: meta.bilibili.embedUrl,
      notes: meta.bilibili.notes,
      platform: "bilibili",
      practiceTip: meta.practiceTip,
      videoSrc: meta.bilibili.videoSrc || TIP_CLIPS[key],
    };
  }
  const meta = YOUTUBE_META[key];
  return {
    skill: skillId,
    title: translate(locale, meta.titleKey),
    channel: meta.channel,
    url: meta.url,
    embedUrl: meta.embedUrl,
    notes: translate(locale, meta.notesKey),
    platform: "youtube",
    practiceTip: meta.practiceEn,
  };
}

/** zh: B站 + 小红书；en: YouTube only. */
export function videosForSkill(skill: string, locale: Locale = "en"): ExampleVideo[] {
  const key = videoSkillKey(skill);
  const skillId = isTechniqueId(skill) ? skill : key;
  if (locale !== "zh") return [videoForSkill(skill, locale)];
  const meta = ZH_VIDEO_META[key];
  return [
    {
      skill: skillId,
      title: meta.title,
      channel: meta.bilibili.channel,
      url: meta.bilibili.url,
      embedUrl: meta.bilibili.embedUrl,
      notes: meta.bilibili.notes,
      platform: "bilibili",
      practiceTip: meta.practiceTip,
      videoSrc: meta.bilibili.videoSrc || TIP_CLIPS[key],
    },
    {
      skill: skillId,
      title: meta.title,
      channel: meta.xiaohongshu.channel,
      url: meta.xiaohongshu.url,
      embedUrl: meta.xiaohongshu.embedUrl,
      notes: meta.xiaohongshu.notes,
      platform: "xiaohongshu",
      practiceTip: meta.practiceTip,
      videoSrc: meta.xiaohongshu.videoSrc,
    },
  ];
}

export const exampleVideos: Record<"forehand" | "backhand" | "serve" | "footwork", ExampleVideo> = {
  forehand: videoForSkill("forehand", "en"),
  backhand: videoForSkill("backhand", "en"),
  serve: videoForSkill("serve", "en"),
  footwork: videoForSkill("footwork", "en"),
};

export function inferSkill(text: string): ExampleSkill {
  if (/反手切削|bh-slice/i.test(text)) return "bh-slice";
  if (/正手切削|fh-slice|切削|slice/i.test(text)) return "fh-slice";
  if (/反手截击|bh-volley/i.test(text)) return "bh-volley";
  if (/正手截击|截击正手|fh-volley|截击|volley/i.test(text)) return "fh-volley";
  if (/高压|smash|overhead/i.test(text)) return "smash";
  if (/反手上旋|底线反手|反手|backhand/i.test(text)) return "bh-topspin";
  if (/正手上旋|底线正手|正手|forehand|topspin/i.test(text)) return "fh-topspin";
  if (/发球|一发|二发|serve/i.test(text)) return "serve";
  if (/步法|分腿|移动|脚步|footwork|split.?step/i.test(text)) return "footwork";
  return "fh-topspin";
}

export type CoachRequest = {
  messages: ChatMessage[];
  confirmedDaily?: boolean;
  confirmedImprove?: boolean;
  coachId?: string;
  locale?: Locale;
};

export type CoachResponse = {
  text: string;
  phase: CoachPhase;
  dailyPlan?: CoachPlan | null;
  improvePlan?: CoachPlan | null;
  tasks: CoachTask[];
  /** Structured eight-technique drill when the user wants to learn a stroke. */
  drill?: CoachDrill | null;
};

type ModelPayload = {
  text?: string;
  dailyPlan?: CoachPlan;
  improvePlan?: CoachPlan;
  tasks?: { id?: string; title?: string; detail?: string; skill?: string }[];
  drill?: CoachDrill;
};

export function resolvePhase(_confirmedDaily: boolean, confirmedImprove: boolean): CoachPhase {
  if (!confirmedImprove) return "improve";
  return "coaching";
}

export function coachLocale(value?: string | null): Locale {
  return isLocale(value) ? value : "en";
}

function t(locale: Locale, key: string) {
  return translate(locale, key);
}

export function defaultImprovePlan(locale: Locale = "en"): CoachPlan {
  return {
    title: t(locale, "coach.planTitle"),
    summary: t(locale, "coach.planSummary"),
    items: [t(locale, "coach.planItem1"), t(locale, "coach.planItem2"), t(locale, "coach.planItem3")],
  };
}

export function defaultTasks(locale: Locale = "en"): CoachTask[] {
  return (
    [
      ["fh-topspin", "coach.taskFhTitle", "coach.taskFhDetail"],
      ["bh-topspin", "coach.taskBhTitle", "coach.taskBhDetail"],
      ["serve", "coach.taskSvTitle", "coach.taskSvDetail"],
    ] as const
  ).map(([skill, titleKey, detailKey]) => ({
    id: `task-${skill}`,
    title: t(locale, titleKey),
    detail: t(locale, detailKey),
    skill,
    video: videoForSkill(skill, locale),
  }));
}

export function fallbackCoachResponse(
  phase: CoachPhase,
  locale: Locale = "en",
  drill?: CoachDrill | null,
): CoachResponse {
  if (drill) {
    const text =
      locale === "zh"
        ? `好，我们按「${drill.title}」章节分步练。顺序：${drill.steps.map((s) => s.phase).join(" → ")}。先从【${drill.steps[0]?.phase || "准备"}】开始。`
        : `We'll practice ${drill.title}. Order: ${drill.steps.map((s) => s.phase).join(" → ")}. Start with ${drill.steps[0]?.phase || "Ready"}.`;
    return {
      text,
      phase: phase === "coaching" ? "coaching" : "improve",
      dailyPlan: null,
      improvePlan:
        locale === "zh"
          ? {
              title: `${drill.title}分步练习`,
              summary: drill.summary,
              items: drill.steps.map((s) => `${s.phase}：${s.cues[0] || ""}`),
            }
          : {
              title: `${drill.title} drill`,
              summary: drill.summary,
              items: drill.steps.map((s) => `${s.phase}: ${s.cues[0] || ""}`),
            },
      tasks: [],
      drill,
    };
  }
  if (phase === "coaching") {
    return {
      text: t(locale, "coach.tasksReady"),
      phase,
      dailyPlan: null,
      improvePlan: defaultImprovePlan(locale),
      tasks: [],
      drill: null,
    };
  }
  return {
    text: t(locale, "coach.planReady"),
    phase: "improve",
    dailyPlan: null,
    improvePlan: defaultImprovePlan(locale),
    tasks: [],
    drill: null,
  };
}

export function coachSystemPrompt(phase: CoachPhase, coachId?: string, locale: Locale = "en") {
  const persona = findCoach(coachId)?.persona;
  const language =
    locale === "zh"
      ? "Reply only in Simplified Chinese. Every user-facing string in text, improvePlan, and drill must be Simplified Chinese. Do not mix English chrome."
      : "Reply only in American English. Every user-facing string in text, improvePlan, and drill must be English. Do not use Chinese.";
  const shared = [
    language,
    persona ||
      (locale === "zh"
        ? "你是涨球教练。短句边线提示。明确学某技术时对齐八项技术要领；泛化目标（如提高球速）给实用建议，不硬套八项模板。"
        : "You are Zhangqiu Coach. Short sideline cues. Use the eight-technique canon when teaching a stroke; for freeform goals give practical advice without forcing the canon."),
    "Do not invent analysis scores. Do not talk about dating.",
    "There is no current-task concept. tasks must always be [].",
    "Demo clips are attached by the system as 视频讲解. Do not paste raw URLs.",
    "Output only one JSON object, no markdown. Fields: text, dailyPlan, improvePlan, tasks, drill, suggestVideoSkill.",
    "dailyPlan / improvePlan look like {title, summary, items: string[]}.",
    "When teaching a stroke, keep drill as {strokeId, title, summary, steps:[{phase, cues:string[]}]} from the eight-technique canon.",
  ];

  if (phase === "improve" || phase === "daily") {
    return [
      ...shared,
      "Only confirm the improvement plan. Fold the week's schedule into it: which days, how long, and two or three things to change.",
      "Do not use a separate daily plan. dailyPlan must be null. improvePlan is required. tasks must be [].",
      "Ask the user to confirm. Do not invent a current-task list.",
      "If the user asks to learn a specific stroke, still provide improvePlan aligned to that stroke and include the structured drill.",
    ].join(" ");
  }

  return [
    ...shared,
    "The improvement plan is confirmed. Continue with practical coaching and optional video lessons.",
    "tasks must be []. Stay on the confirmed plan. dailyPlan must be null.",
  ].join(" ");
}

export function openingUserPrompt(phase: CoachPhase, locale: Locale = "en") {
  if (phase === "improve" || phase === "daily") return t(locale, "coach.openPlan");
  return t(locale, "coach.openTasks");
}

function localeText(text: string, locale: Locale, fallback = "") {
  const value = text.trim();
  if (!value) return fallback;
  const hasZh = /[\u4e00-\u9fff]/.test(value);
  if (locale === "zh" && !hasZh) return fallback;
  if (locale === "en" && hasZh) return fallback;
  return value;
}

function asPlan(value: unknown, locale: Locale, fallback: CoachPlan): CoachPlan | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CoachPlan>;
  const items = Array.isArray(item.items)
    ? item.items
        .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
        .map((row) => localeText(row, locale))
        .filter(Boolean)
    : [];
  const title = localeText(String(item.title || ""), locale);
  const summary = localeText(String(item.summary || ""), locale);
  if (!title && !summary && items.length === 0) return null;
  return {
    title: title || fallback.title,
    summary: summary || fallback.summary,
    items: items.length ? items : fallback.items,
  };
}

function extractJson(text: string): ModelPayload | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1] || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ModelPayload;
  } catch {
    return null;
  }
}

function asDrill(value: unknown, locale: Locale, preferred?: CoachDrill | null): CoachDrill | null {
  if (preferred) return preferred;
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CoachDrill>;
  const strokeId = String(item.strokeId || "");
  if (!isTechniqueId(strokeId)) return null;
  const canon = buildCoachDrill(strokeId, locale === "zh" ? "zh" : "en");
  // Prefer canon cues so the UI never drifts from the eight-technique source.
  return canon;
}

export function parseCoachPayload(
  raw: string,
  phase: CoachPhase,
  locale: Locale = "en",
  preferredDrill?: CoachDrill | null,
): CoachResponse {
  const fallback = fallbackCoachResponse(phase, locale, preferredDrill);
  const parsed = extractJson(raw);
  const rawText =
    (parsed?.text && parsed.text.trim()) ||
    raw.replace(/```[\s\S]*```/, "").replace(/\{[\s\S]*\}$/, "").trim() ||
    raw.trim();
  const text = localeText(rawText, locale, fallback.text);
  const planFallback = fallback.improvePlan || defaultImprovePlan(locale);
  const dailyPlan = asPlan(parsed?.dailyPlan, locale, planFallback);
  const parsedImprove = asPlan(parsed?.improvePlan, locale, planFallback);
  const improvePlan =
    parsedImprove || dailyPlan || (phase === "improve" || phase === "daily" ? planFallback : fallback.improvePlan);

  // Product no longer surfaces 「当前任务」— always empty.
  const tasks: CoachTask[] = [];

  const drill = asDrill(parsed?.drill, locale, preferredDrill) || preferredDrill || null;

  return {
    text,
    phase,
    dailyPlan: null,
    improvePlan,
    tasks,
    drill,
  };
}
