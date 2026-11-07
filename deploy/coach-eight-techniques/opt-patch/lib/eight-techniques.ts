/**
 * 涨球教练八项技术要领 — source of truth for AI chat, drills, and analysis prompts.
 * Canon text must stay aligned with docs/zhangqiu-coach-eight-techniques.md (do not paraphrase away detail).
 */

export type TechniqueId =
  | "fh-topspin"
  | "bh-topspin"
  | "fh-volley"
  | "bh-volley"
  | "fh-slice"
  | "bh-slice"
  | "serve"
  | "smash";

export type DrillPhaseId =
  | "ready"
  | "takeback"
  | "contact"
  | "follow"
  | "chain"
  | "errors"
  | "details"
  | "strategy"
  | "compare";

export type DrillPhase = {
  id: DrillPhaseId;
  /** Chinese phase label used in zh UI / prompts */
  labelZh: string;
  /** English phase label used in en UI / prompts */
  labelEn: string;
  cues: string[];
};

export type TechniqueCanon = {
  id: TechniqueId;
  /** Canon section title (Chinese) */
  titleZh: string;
  titleEn: string;
  /** Aliases that map natural language → this stroke */
  aliases: string[];
  phases: DrillPhase[];
};

/** Full structured canon — keep cue wording faithful to the eight-techniques doc. */
export const EIGHT_TECHNIQUES: TechniqueCanon[] = [
  {
    id: "fh-topspin",
    titleZh: "底线正手",
    titleEn: "Baseline forehand",
    aliases: [
      "正手上旋",
      "底线正手",
      "正手抽球",
      "正手",
      "forehand topspin",
      "topspin forehand",
      "forehand",
      "fh-topspin",
    ],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready",
        cues: [
          "重心降低",
          "步幅略宽于肩",
          "双手举在身体正前方",
          "左肩对准来球",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "身体作为整体转体拉拍，从前往后没有任何多余动作",
          "保持准备姿势不变，仅通过转动身体完成拉拍",
          "完成后：主导手掌心朝向 6:00（后下方），手掌心朝下后下方",
          "右手选手：主导手（右手）指向 6:00，辅助手（左手）指向 3:00",
          "左手选手：主导手（左手）指向 6:00，辅助手（右手）指向 9:00",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "拍子由高往下放，到达腰间高度",
          "自下而上击球（标准上旋球动作）",
          "击球瞬间手臂做内旋",
          "收拍打到左肩膀（右手选手）",
          "击球点：胸口高度，身体右侧稍远距离，身体前方 45° 方向",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: [
          "击球后手臂内旋，往前上方收拍",
          "不能垂直向上收拍",
          "随挥时手掌心朝向外侧，不是朝向身体",
          "收拍位置取决于上旋程度：重上旋时收拍位置更低",
        ],
      },
      {
        id: "chain",
        labelZh: "动力链",
        labelEn: "Kinetic chain",
        cues: ["发力顺序自下而上：腿 → 腰髋 → 躯干 → 肩膀 → 手臂 → 球拍"],
      },
      {
        id: "errors",
        labelZh: "常见错误",
        labelEn: "Common errors",
        cues: [
          "「擦玻璃」动作：拉拍完成后掌心朝向侧面（而非后下方），导致击球打向天花板。正确做法：掌心朝向后下方，做「拍凳子」动作，由高往低拍，再向前击打",
          "只动手不转体：拉拍只有持拍手在动，身体没有转，导致力量脱节、打不准球",
          "击球时重心未向前转移：原地发力，球打不远打不深",
          "用左手（辅助手）指球，而非左肩指球：转体蓄力不够",
        ],
      },
    ],
  },
  {
    id: "bh-topspin",
    titleZh: "底线反手",
    titleEn: "Baseline backhand",
    aliases: [
      "反手上旋",
      "底线反手",
      "双手反拍",
      "单反",
      "反手",
      "backhand topspin",
      "backhand",
      "bh-topspin",
    ],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready",
        cues: [
          "对手击球时立即转肩（左肩对球网，右手选手）",
          "非持拍手扶拍喉辅助引拍",
          "双脚与肩同宽，膝盖微屈，重心在前脚掌",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "非持拍手推动球拍向后，拍头高于手腕",
          "用肩膀转动带动引拍（不只用手臂）",
          "双手反拍：左肘贴近身体",
          "单反：拍面稍关闭",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "身体前方（约髋部高度）击球",
          "手腕固定，拍面垂直地面",
          "重心从后脚转移到前脚",
          "单反：伸直手臂击球",
          "双手反拍：左手（上侧手）发力主导",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: [
          "继续向前推送，拍头随挥至肩部以上",
          "双手反拍收拍过高易失误",
          "非持拍手接住拍颈，帮助制动还原",
        ],
      },
      {
        id: "errors",
        labelZh: "常见错误",
        labelEn: "Common errors",
        cues: [
          "引拍过晚：被球挤到，只能用「捞球」动作",
          "手腕松动：掉拍头或翻腕，球易下网或飞出",
          "重心后仰：击球时身体后倒，击球点过高",
        ],
      },
    ],
  },
  {
    id: "fh-volley",
    titleZh: "截击正手",
    titleEn: "Forehand volley",
    aliases: ["截击正手", "正手截击", "forehand volley", "fh-volley", "正手拦网"],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready",
        cues: [
          "大陆式握拍（锤子握法），食指稍分开扣拍柄",
          "双膝微屈，重心在前脚掌",
          "非持拍手轻托拍喉，拍头高于手腕，拍面半开",
          "胸口对准来球",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "引拍幅度极小，不超过身体右侧后方",
          "右肩向后转带动球拍后拉，拍头略高于手腕",
          "非持拍手向左前方伸出「指认」来球",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "击球点在身体右前方 45–60cm（比底线正手更靠前）",
          "高度在胸口到腰部，太低则屈膝降重心",
          "异侧脚（左脚）向前跨出，形成弓步",
          "手腕锁死，拍面微开（80–85 度）",
          "前臂微内旋，从高到低向前下方短促推压（20–30cm 行程）",
          "力量源于重心前移和转髋，不挥大臂",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: ["拍头走向前下方，随挥不超过身体正面一尺", "非持拍手接拍颈制动"],
      },
      {
        id: "details",
        labelZh: "隐蔽细节",
        labelEn: "Hidden details",
        cues: [
          "拍头始终高于手腕",
          "脚步是「跨」不是「迈」，形成前后脚对抗力",
          "眼睛盯球到拍面",
          "球快借力，球慢主动迎击",
        ],
      },
    ],
  },
  {
    id: "bh-volley",
    titleZh: "截击反手",
    titleEn: "Backhand volley",
    aliases: ["截击反手", "反手截击", "backhand volley", "bh-volley", "反手拦网"],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready",
        cues: [
          "大陆式握拍，拇指直贴拍柄背面",
          "双膝微屈，重心在前脚掌",
          "非持拍手轻托拍喉，拍头高于手腕，拍面半开",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "引拍幅度比正手截击更小，拍柄末端只转到左胯前方",
          "右肩向后转动带动球拍后拉",
          "非持拍手向右后方伸展，强制充分转肩",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "击球点在身体左前方 40–50cm，胸口到腰部高度",
          "左脚向右前方跨出，形成弓步",
          "手腕锁死，拍面约 75–80 度（比正手更关闭）",
          "前臂微外旋，从高到低向前下方短促「切砍」（约 20cm 行程）",
          "肘关节保持微屈（约 150 度），不伸直",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: ["拍头走向前下方，不超过身体左侧一尺", "非持拍手接拍颈制动"],
      },
      {
        id: "details",
        labelZh: "专属细节",
        labelEn: "Stroke details",
        cues: [
          "拍面比正手更关闭",
          "肘关节保持微屈",
          "左脚向左前方 45 度跨步",
          "高球用「磕挡」，不挥拍",
        ],
      },
    ],
  },
  {
    id: "fh-slice",
    titleZh: "正手切削",
    titleEn: "Forehand slice",
    aliases: ["正手切削", "正手切球", "forehand slice", "fh-slice", "正手削球"],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready & grip",
        cues: [
          "大陆式握拍（像握菜刀）",
          "关闭式或半开放式站位，右肩对准球网",
          "非持拍手轻扶拍喉，双膝微屈",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "球拍举高至右肩上方（齐耳高度），拍头指向天空，拍面微打开",
          "非持拍手向后伸展保持平衡，重心在右脚",
          "引拍路径像在身侧画「C」字",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "击球点在身体右前方，约腰部高度",
          "重心从右脚转移到左脚，左脚向右前方跨出",
          "拍面打开约 45 度，手腕锁死",
          "拍头从右肩高度向左膝前方陡峭斜线劈砍",
          "力量源自重心前移和肩部转动",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: ["拍头随挥至左膝外侧，拍面朝下", "非持拍手接拍颈制动", "随挥必须完整"],
      },
    ],
  },
  {
    id: "bh-slice",
    titleZh: "反手切削",
    titleEn: "Backhand slice",
    aliases: ["反手切削", "反手切球", "backhand slice", "bh-slice", "反手削球"],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready & grip",
        cues: ["大陆式握拍，拇指直贴拍柄背面", "关闭式站位，右肩对准球网，重心在右脚"],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "球拍举高至左肩上方，拍头指向天空，拍面打开",
          "非持拍手扶拍喉协助引拍，左肩向后充分转动",
          "引拍路径是直线向后上方（非 C 字）",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "击球点在身体左前方，腰部到胸部之间",
          "重心从右脚转移到左脚，右脚向左前方跨出",
          "拍面打开约 45–50 度（比正手稍开），手腕锁死",
          "拍头从左肩高度向右膝前方较平缓斜线推切",
          "强调向前推送多于向下劈砍",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: [
          "拍头随挥至右膝外侧，拍面朝下",
          "随挥方向更偏向前方",
          "非持拍手接拍颈制动，随挥后保持侧身",
        ],
      },
      {
        id: "details",
        labelZh: "专属细节",
        labelEn: "Stroke details",
        cues: [
          "非持拍手全程扶拍直到击球前",
          "拍面比正手更开 5 度",
          "向前推送多于向下劈砍",
          "随挥后保持侧身，利于回位",
        ],
      },
    ],
  },
  {
    id: "serve",
    titleZh: "发球",
    titleEn: "Serve",
    aliases: ["发球", "一发", "二发", "平击发球", "侧旋发球", "侧上旋发球", "serve", "first serve", "second serve"],
    phases: [
      {
        id: "compare",
        labelZh: "三种发球对比",
        labelEn: "Serve types",
        cues: [
          "平击：击球点最高点（12 点）；挥拍从后向前直线撞击；效果低平、前冲快",
          "侧旋：击球点偏右（2 点）；从右向左横向摩擦；弹跳低、向外拐",
          "侧上旋：击球点偏左（10 点）；从下向上提拉摩擦；弹跳高、前冲猛",
        ],
      },
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready",
        cues: ["侧身时左肩对准球网"],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact by type",
        cues: [
          "平击发球：大陆式握拍，拍面几乎垂直地面；抛球在头顶正上方偏右（12 点），略靠前；拍头从背后直线向前上方撞击球中后部；手腕内旋产生爆发力",
          "侧旋发球：大陆式握拍，拍面略打开；抛球在头顶右侧（2 点）；拍头从右向左横向摩擦球右侧；肘部抬高，拍头在手腕上方划过",
          "侧上旋发球：大陆式握拍，拍面稍关闭；抛球在头顶左侧后方（10 点），甚至到头后；拍头从下向上猛烈提拉球左上侧；背弓充分拉开，肘部指向天空",
        ],
      },
      {
        id: "strategy",
        labelZh: "实战策略",
        labelEn: "Match strategy",
        cues: [
          "Deuce 侧（一区）：侧上旋发外角压反手，平击发内角追身",
          "Ad 侧（二区）：侧旋发外角拉开正手，平击发内角压反手",
          "二发：以侧上旋为主",
        ],
      },
    ],
  },
  {
    id: "smash",
    titleZh: "高压球",
    titleEn: "Overhead smash",
    aliases: ["高压", "高压球", "杀高球", "smash", "overhead", "overhead smash"],
    phases: [
      {
        id: "ready",
        labelZh: "准备",
        labelEn: "Ready & turn",
        cues: [
          "对方挑高球后，立刻侧身转肩，左肩对准来球",
          "非持拍手上举指球（像瞄准镜）",
          "后交叉步或侧滑步快速后退",
          "绝不仰头后退，必须侧身跑动",
        ],
      },
      {
        id: "takeback",
        labelZh: "引拍",
        labelEn: "Takeback",
        cues: [
          "非持拍手继续指球",
          "持拍手自然下垂，「挠背」姿势（拍头朝下，肘部朝上）",
          "引拍幅度比发球更小",
        ],
      },
      {
        id: "contact",
        labelZh: "击球",
        labelEn: "Contact",
        cues: [
          "身体正上方偏右前，手臂几乎伸直的最高点",
          "重心从后脚转移到前脚",
          "手腕内旋，拍面垂直撞击球后上部",
          "「用指尖去够天花板」",
        ],
      },
      {
        id: "follow",
        labelZh: "随挥",
        labelEn: "Follow-through",
        cues: ["拍头向前下方挥动至身体对侧下方", "非持拍手接拍颈制动"],
      },
      {
        id: "details",
        labelZh: "细节",
        labelEn: "Four details",
        cues: [
          "非持拍手全程指球",
          "小碎步调整，球落点在右肩正上方",
          "球浅向前迎，球深后退打",
          "拍面微开约 80 度，手腕锁死",
        ],
      },
      {
        id: "errors",
        labelZh: "常见错误",
        labelEn: "Error fixes",
        cues: [
          "下网 → 击球点太低/拍面过闭 → 后退半步，拍面打开",
          "出底线 → 手腕翻动/身体后仰 → 手腕内旋固定，重心前压",
          "打不到甜区 → 非持拍手没指球",
        ],
      },
    ],
  },
];

const BY_ID = Object.fromEntries(EIGHT_TECHNIQUES.map((t) => [t.id, t])) as Record<
  TechniqueId,
  TechniqueCanon
>;

export function getTechnique(id: TechniqueId): TechniqueCanon {
  return BY_ID[id];
}

export function isTechniqueId(value: string): value is TechniqueId {
  return value in BY_ID;
}

/**
 * Map natural-language intent to one of the eight strokes.
 * 「正手上旋」 → fh-topspin (底线正手 section).
 * More specific aliases win (slice/volley before bare 正手/反手).
 */
export function resolveTechniqueIntent(text: string): TechniqueId | null {
  const blob = String(text || "").trim();
  if (!blob) return null;

  const learnish =
    /想学|学习|教我|带我练|练习|练一下|怎么打|如何打|要点|要领|纠正|纠错|learn|practice|teach|drill|how (do|to) (hit|play)/i.test(
      blob,
    ) ||
    /正手上旋|反手上旋|正手切削|反手切削|截击正手|截击反手|正手截击|反手截击|高压球|发球|底线正手|底线反手|forehand|backhand|volley|slice|serve|smash/i.test(
      blob,
    );

  if (!learnish && !/正手|反手|截击|切削|发球|高压|forehand|backhand|volley|slice|serve|smash/i.test(blob)) {
    return null;
  }

  // Specific before generic.
  const ordered: TechniqueId[] = [
    "fh-slice",
    "bh-slice",
    "fh-volley",
    "bh-volley",
    "smash",
    "serve",
    "bh-topspin",
    "fh-topspin",
  ];

  const lower = blob.toLowerCase();
  for (const id of ordered) {
    const tech = BY_ID[id];
    for (const alias of tech.aliases) {
      if (alias.length >= 2 && (blob.includes(alias) || lower.includes(alias.toLowerCase()))) {
        return id;
      }
    }
  }

  // Bare family words after specific checks.
  if (/反手|backhand/i.test(blob)) return "bh-topspin";
  if (/正手|forehand|topspin/i.test(blob)) return "fh-topspin";
  if (/截击|volley/i.test(blob)) return "fh-volley";
  if (/切削|slice/i.test(blob)) return "fh-slice";
  if (/高压|smash|overhead/i.test(blob)) return "smash";
  if (/发球|serve/i.test(blob)) return "serve";
  return null;
}

export type CoachDrill = {
  strokeId: TechniqueId;
  title: string;
  summary: string;
  steps: { phase: string; cues: string[] }[];
};

export function buildCoachDrill(id: TechniqueId, locale: "zh" | "en" = "zh"): CoachDrill {
  const tech = BY_ID[id];
  const title = locale === "zh" ? tech.titleZh : tech.titleEn;
  const steps = tech.phases.map((p) => ({
    phase: locale === "zh" ? p.labelZh : p.labelEn,
    cues: [...p.cues],
  }));
  const summary =
    locale === "zh"
      ? `按「${title}」章节分步练：${steps.map((s) => s.phase).join(" → ")}。`
      : `Practice ${title} in order: ${steps.map((s) => s.phase).join(" → ")}.`;
  return { strokeId: id, title, summary, steps };
}

/** Markdown-ish block injected into LLM system prompts (full cues, not paraphrased). */
export function techniquePromptBlock(id: TechniqueId, locale: "zh" | "en" = "zh"): string {
  const tech = BY_ID[id];
  const title = locale === "zh" ? tech.titleZh : tech.titleEn;
  const lines: string[] = [`【${title}】`];
  for (const phase of tech.phases) {
    const label = locale === "zh" ? phase.labelZh : phase.labelEn;
    lines.push(`### ${label}`);
    for (const cue of phase.cues) lines.push(`- ${cue}`);
  }
  return lines.join("\n");
}

/** Entire eight-technique canon for 涨球教练 knowledge base. */
export function fullCanonPrompt(locale: "zh" | "en" = "zh"): string {
  const header =
    locale === "zh"
      ? "涨球教练核心教学理念以以下 8 项网球技术要领为准。分析纠错、教练问答、练习引导均必须对齐对应章节结构与要点，不得另起体系。"
      : "Zhangqiu Coach teaching must follow these eight technique sections. Analysis, Q&A, and drills must stay on this structure — do not invent another system.";
  return [header, ...EIGHT_TECHNIQUES.map((t) => techniquePromptBlock(t.id, locale))].join("\n\n");
}

export function drillGuideSystemRules(locale: "zh" | "en", drill: CoachDrill): string {
  if (locale === "zh") {
    return [
      `用户想学「${drill.title}」。你必须按该章节分步带练，顺序固定：${drill.steps.map((s) => s.phase).join(" → ")}。`,
      "每一轮只讲当前一步的要点，引用章节原句要点，不要另造动作体系。",
      "先从第一步开始；用户说「下一步 / 继续 / 下一阶段」再进入下一步。",
      "回答身份始终是「涨球教练」。",
      "JSON 额外字段 drill 必须原样保留系统给出的结构化步骤（title/summary/steps），不要改写 cues。",
      "若用户尚未进入提升计划确认，仍可先做分步带练；improvePlan 可简短对齐这项技术。",
    ].join(" ");
  }
  return [
    `The player wants to learn "${drill.title}". Guide practice in fixed order: ${drill.steps.map((s) => s.phase).join(" → ")}.`,
    "One phase per reply; keep cues from the canon; do not invent another system.",
    "Start at step 1; advance only when the user asks for the next step.",
    "Always identify as Zhangqiu Coach.",
    "Keep the structured drill field (title/summary/steps) unchanged.",
  ].join(" ");
}

export function drillOpeningText(drill: CoachDrill, locale: "zh" | "en"): string {
  if (locale === "zh") {
    const first = drill.steps[0];
    const cues = (first?.cues || []).map((c) => `· ${c}`).join("\n");
    return `好，我们按「${drill.title}」来练。顺序：${drill.steps.map((s) => s.phase).join(" → ")}。\n先从【${first?.phase || "准备"}】开始：\n${cues}\n练完这步跟我说「下一步」。`;
  }
  const first = drill.steps[0];
  const cues = (first?.cues || []).map((c) => `· ${c}`).join("\n");
  return `We'll practice ${drill.title}. Order: ${drill.steps.map((s) => s.phase).join(" → ")}.\nStart with [${first?.phase || "Ready"}]:\n${cues}\nSay "next" when ready.`;
}

/** Library prompt seed text for a stroke (coach stroke library). */
export function libraryPromptForStroke(id: TechniqueId): string {
  return techniquePromptBlock(id, "zh");
}
