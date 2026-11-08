/**
 * Coach-tab video guidance: map sslip/tai analysis results into
 * 涨球教练 chat copy aligned with the eight-technique canon.
 */

import {
  buildCoachDrill,
  getTechnique,
  isTechniqueId,
  type CoachDrill,
  type TechniqueId,
} from "@/lib/eight-techniques";

export type CoachVideoAxis = {
  key: string;
  score: number;
  max: number;
  tip?: string;
};

export type CoachVideoResult = {
  jobId: string;
  stroke?: string | null;
  total?: number | null;
  grade?: string | null;
  focus?: string | null;
  axes?: CoachVideoAxis[];
  sourceName?: string | null;
};

export type GuidanceBundle = {
  techniqueId: TechniqueId | null;
  drill: CoachDrill | null;
  /** User bubble text */
  userText: string;
  /** 涨球教练 bubble text */
  aiText: string;
  /** Network-coach board / inbox message */
  networkText: string;
};

const AXIS_LABEL_ZH: Record<string, string> = {
  balance: "重心",
  contact: "击球点",
  chain: "动力链",
  effect: "击球效果",
};

const AXIS_LABEL_EN: Record<string, string> = {
  balance: "Balance",
  contact: "Contact",
  chain: "Kinetic chain",
  effect: "Ball effect",
};

/** UI picker options — eight techniques + auto. */
export const COACH_VIDEO_STROKES: { id: string; apiStroke: string; labelZh: string; labelEn: string }[] = [
  { id: "auto", apiStroke: "auto", labelZh: "自动识别", labelEn: "Auto-detect" },
  { id: "fh-topspin", apiStroke: "fh-topspin", labelZh: "底线正手", labelEn: "Baseline forehand" },
  { id: "bh-topspin", apiStroke: "bh-topspin", labelZh: "底线反手", labelEn: "Baseline backhand" },
  { id: "fh-volley", apiStroke: "fh-volley", labelZh: "截击正手", labelEn: "Forehand volley" },
  { id: "bh-volley", apiStroke: "bh-volley", labelZh: "截击反手", labelEn: "Backhand volley" },
  { id: "fh-slice", apiStroke: "fh-slice", labelZh: "正手切削", labelEn: "Forehand slice" },
  { id: "bh-slice", apiStroke: "bh-slice", labelZh: "反手切削", labelEn: "Backhand slice" },
  { id: "serve", apiStroke: "serve", labelZh: "发球", labelEn: "Serve" },
  { id: "smash", apiStroke: "smash", labelZh: "高压球", labelEn: "Smash" },
];

/** Map analysis stroke / picker id → eight-technique id when known. */
export function resolveTechniqueFromStroke(stroke?: string | null, pickerId?: string | null): TechniqueId | null {
  const candidates = [pickerId, stroke].filter(Boolean).map((s) => String(s).trim().toLowerCase());
  for (const raw of candidates) {
    if (isTechniqueId(raw)) return raw;
    if (raw === "forehand" || raw === "fh" || raw.includes("forehand")) return "fh-topspin";
    if (raw === "backhand" || raw === "bh" || raw.includes("backhand")) return "bh-topspin";
    if (raw.includes("volley") && raw.includes("back")) return "bh-volley";
    if (raw.includes("volley")) return "fh-volley";
    if (raw.includes("slice") && raw.includes("back")) return "bh-slice";
    if (raw.includes("slice") || raw.includes("chip")) return "fh-slice";
    if (raw.includes("serve") || raw.includes("发球")) return "serve";
    if (raw.includes("smash") || raw.includes("overhead") || raw.includes("高压")) return "smash";
    if (raw.includes("正手上旋") || raw.includes("底线正手")) return "fh-topspin";
    if (raw.includes("反手上旋") || raw.includes("底线反手")) return "bh-topspin";
  }
  return null;
}

function techniqueTitle(id: TechniqueId | null, zh: boolean): string {
  if (!id) return zh ? "挥拍" : "swing";
  const tech = getTechnique(id);
  return zh ? tech.titleZh : tech.titleEn;
}

function axisLabel(key: string, zh: boolean): string {
  return (zh ? AXIS_LABEL_ZH : AXIS_LABEL_EN)[key] || key;
}

/** Build dual-channel copy from a finished tai/sslip job result. */
export function buildGuidanceBundle(
  result: CoachVideoResult,
  opts: { locale: "zh" | "en"; pickerId?: string | null; fileName?: string | null },
): GuidanceBundle {
  const zh = opts.locale === "zh";
  const techniqueId = resolveTechniqueFromStroke(result.stroke, opts.pickerId);
  const title = techniqueTitle(techniqueId, zh);
  const score = typeof result.total === "number" ? result.total : null;
  const grade = result.grade ? String(result.grade) : "";
  const scoreLine =
    score != null
      ? zh
        ? `综合 ${score}${grade ? `（${grade}）` : ""}`
        : `Score ${score}${grade ? ` (${grade})` : ""}`
      : zh
        ? "已完成分析"
        : "Analysis complete";

  const userText = zh
    ? `我上传了一段「${title}」视频${opts.fileName ? `（${opts.fileName}）` : ""}，请涨球教练和网络教练一起给指导。`
    : `I uploaded a 「${title}」 clip${opts.fileName ? ` (${opts.fileName})` : ""}. Please coach me — Zhangqiu AI and my network coach.`;

  const tipLines = (result.axes || [])
    .filter((a) => a?.tip)
    .map((a) => {
      const label = axisLabel(a.key, zh);
      const marks = `${a.score}/${a.max}`;
      return zh ? `· ${label} ${marks}：${a.tip}` : `· ${label} ${marks}: ${a.tip}`;
    });

  const drill = techniqueId ? buildCoachDrill(techniqueId, opts.locale) : null;
  const errorCues =
    drill?.steps.find((s) => /常见错误|Errors|errors/i.test(s.phase))?.cues.slice(0, 3) ||
    drill?.steps.find((s) => s.phase)?.cues.slice(0, 2) ||
    [];

  const aiParts: string[] = [];
  if (zh) {
    aiParts.push(`我看过你的视频了（任务 ${result.jobId}）。动作判断：${title} · ${scoreLine}。`);
    if (tipLines.length) {
      aiParts.push("四维提示：");
      aiParts.push(...tipLines);
    }
    if (techniqueId && errorCues.length) {
      aiParts.push(`对照「${title}」八项要领，先盯这几条：`);
      errorCues.forEach((c) => aiParts.push(`· ${c}`));
      aiParts.push("需要分步带练时，直接说「我想学」+ 动作名即可。");
    } else if (!techniqueId) {
      aiParts.push("还没确定具体技术动作。告诉我是正手、反手、截击、切削、发球还是高压，我按八项要领带你练。");
    }
  } else {
    aiParts.push(`I reviewed your clip (job ${result.jobId}). Stroke: ${title} · ${scoreLine}.`);
    if (tipLines.length) {
      aiParts.push("Four-dimension tips:");
      aiParts.push(...tipLines);
    }
    if (techniqueId && errorCues.length) {
      aiParts.push(`Against the ${title} canon, focus on:`);
      errorCues.forEach((c) => aiParts.push(`· ${c}`));
      aiParts.push('Say "I want to learn" + stroke name for a step-by-step drill.');
    } else if (!techniqueId) {
      aiParts.push("Stroke is unclear. Tell me forehand, backhand, volley, slice, serve, or smash.");
    }
  }

  const networkText = zh
    ? [
        `【视频求指导】${title} · ${scoreLine}`,
        opts.fileName ? `文件：${opts.fileName}` : "",
        `涨球教练已根据分析给出意见。请帮我看看这段挥拍，再补充你的指导。`,
        `分析任务：${result.jobId}`,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `[Video coaching request] ${title} · ${scoreLine}`,
        opts.fileName ? `File: ${opts.fileName}` : "",
        `Zhangqiu Coach already commented from the analysis. Please review this swing and add your guidance.`,
        `Job: ${result.jobId}`,
      ]
        .filter(Boolean)
        .join("\n");

  return {
    techniqueId,
    drill,
    userText,
    aiText: aiParts.join("\n"),
    networkText,
  };
}
