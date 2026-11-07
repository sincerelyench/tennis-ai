import { filmingExamples, type ApiStroke } from "@/lib/analysis";

export const COACH_STORAGE_KEY = "tennis-ai-coach";
export const DEFAULT_COACH_ID = "poppy";

export type CoachId = "poppy";

export type CoachLesson = {
  strokeId: ApiStroke;
  titleKey: string;
  clip: string;
  poster: string;
};

export type CoachProfile = {
  id: CoachId;
  nameKey: string;
  shortKey: string;
  bioKey: string;
  highlightKeys: string[];
  lessons: CoachLesson[];
  persona: string;
};

function lesson(strokeId: ApiStroke, titleKey: string): CoachLesson {
  const example = filmingExamples[strokeId] || filmingExamples["fh-topspin"];
  return { strokeId, titleKey, clip: example.video, poster: example.poster };
}

export const coachRoster: CoachProfile[] = [
  {
    id: "poppy",
    nameKey: "roster.poppy.name",
    shortKey: "roster.poppy.short",
    bioKey: "roster.poppy.bio",
    highlightKeys: ["roster.poppy.h1", "roster.poppy.h2", "roster.poppy.h3", "roster.poppy.h4"],
    lessons: [
      lesson("fh-topspin", "roster.poppy.v1"),
      lesson("serve", "roster.poppy.v2"),
      lesson("bh-topspin", "roster.poppy.v3"),
    ],
    persona:
      "你是涨球教练（Zhangqiu Coach）。教学、纠错、问答必须以八项技术要领为准：底线正手、底线反手、截击正手、截击反手、正手切削、反手切削、发球、高压。用户说想学某动作（如正手上旋）时，映射到对应章节（正手上旋→底线正手），按该章适用的 准备→引拍→击球→随挥→动力链→常见错误 分步带练，引用章节要点，不要另起体系。边线短句，一次只强调当前一步。不要自称 Poppy、东东或掌球教练。You may sign a cue as 涨球教练.",
  },
];

export function isCoachId(value: unknown): value is CoachId {
  return value === "poppy";
}

export function findCoach(id?: string | null): CoachProfile | null {
  return coachRoster.find((item) => item.id === id) || null;
}

export function readCoachId(): CoachId {
  if (typeof window === "undefined") return DEFAULT_COACH_ID;
  try {
    const saved = window.localStorage.getItem(COACH_STORAGE_KEY);
    if (isCoachId(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_COACH_ID;
}

export function writeCoachId(id: CoachId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, id);
    document.cookie = `${COACH_STORAGE_KEY}=${id};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function coachLessonForStroke(coachId: string | undefined, strokeId?: string | null): CoachLesson | null {
  const coach = findCoach(coachId) || findCoach(DEFAULT_COACH_ID);
  if (!coach) return null;
  const found = coach.lessons.find((item) => item.strokeId === strokeId);
  if (found) return found;
  const key = (strokeId && filmingExamples[strokeId as ApiStroke] ? strokeId : "fh-topspin") as ApiStroke;
  return lesson(key, "roster.poppy.v1");
}
