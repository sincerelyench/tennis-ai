/**
 * Map analysis problem points (重心 / 击球点 / 动力链 / 击球效果) →
 * correct-action demos for the report 「正确动作」 section.
 *
 * Rules (涨球):
 * 1. Detect issues from findings text + low four-dim scores.
 * 2. Prefer published coach library video when the player selected that coach.
 * 3. Otherwise use the stroke's famous-star HD demo (never muddy /tennis/examples).
 * 4. Each detected issue gets its own正确动作 card labeled with that issue.
 */

import { starDemoForStroke } from "@/lib/star-demos";
import { strokeKeyFrom, type StrokeDemoItem } from "@/lib/demo-catalog";
import { fetchCoachLibraryDemo } from "@/lib/coach-library-analysis-hook";

export type IssueAxis = "重心" | "击球点" | "动力链" | "击球效果";
export type IssueAxisKey = "balance" | "contact" | "chain" | "effect";

export type IssuePoint = {
  id: string;
  axis: IssueAxis;
  axisKey: IssueAxisKey;
  labelZh: string;
  labelEn: string;
  finding?: string;
  score?: number;
  max?: number;
};

export type IssueCorrectDemo = {
  issue: IssuePoint;
  demo: StrokeDemoItem;
  source: "star" | "coach";
  creditZh: string;
  creditEn: string;
  status: "ready" | "empty";
};

const AXIS_META: Record<
  IssueAxis,
  { axisKey: IssueAxisKey; max: number; low: number; labelZh: string; labelEn: string }
> = {
  重心: { axisKey: "balance", max: 25, low: 18, labelZh: "重心", labelEn: "Balance" },
  击球点: { axisKey: "contact", max: 20, low: 14, labelZh: "击球点", labelEn: "Contact" },
  动力链: { axisKey: "chain", max: 30, low: 20, labelZh: "动力链", labelEn: "Kinetic chain" },
  击球效果: { axisKey: "effect", max: 25, low: 18, labelZh: "击球效果", labelEn: "Ball effect" },
};

/** Finding-line → issue rules (aligned with lib/visual-coach.ts PROBLEM RULES + analyze issue keys). */
const ISSUE_RULES: {
  test: RegExp;
  id: string;
  axis: IssueAxis;
  labelZh: string;
  labelEn: string;
}[] = [
  {
    test: /重心|直腿|站得|头肩|weight|straight leg|cog_high|cog_unstable/i,
    id: "weight",
    axis: "重心",
    labelZh: "重心偏高 / 不稳",
    labelEn: "Balance too high / unstable",
  },
  {
    test: /步幅偏窄|开立不够|两脚太近|站位|stance too narrow|feet too close|stance_narrow/i,
    id: "stance",
    axis: "重心",
    labelZh: "站位偏窄",
    labelEn: "Stance too narrow",
  },
  {
    test: /击球点.*晚|太后|偏晚|contact late|too far back|late_contact|挤在|贴在/i,
    id: "late",
    axis: "击球点",
    labelZh: "击球点偏晚",
    labelEn: "Contact late",
  },
  {
    test: /击球点.*低|最高点|contact too low|contact_low|peak/i,
    id: "contact_low",
    axis: "击球点",
    labelZh: "击球点偏低",
    labelEn: "Contact too low",
  },
  {
    test: /击球点.*高|contact_high|contact too high/i,
    id: "contact_high",
    axis: "击球点",
    labelZh: "击球点偏高",
    labelEn: "Contact too high",
  },
  {
    test: /够不着|伸手|hand_reach|reach/i,
    id: "reach",
    axis: "击球点",
    labelZh: "击球点够不着",
    labelEn: "Contact out of reach",
  },
  {
    test: /转肩|转髋|动力链|只动手|肩髋|shoulder turn|kinetic chain|chain_break/i,
    id: "turn",
    axis: "动力链",
    labelZh: "动力链断裂 / 转体不足",
    labelEn: "Kinetic chain / short turn",
  },
  {
    test: /拍没落|后摆偏浅|后口袋|引拍|racket head not dropped|late takeback|takeback_shallow/i,
    id: "takeback",
    axis: "动力链",
    labelZh: "引拍偏浅",
    labelEn: "Shallow takeback",
  },
  {
    test: /提前迈步|early_step|both_feet_off|双脚离地/i,
    id: "step",
    axis: "动力链",
    labelZh: "脚步时机",
    labelEn: "Footwork timing",
  },
  {
    test: /拍头偏慢|速度偏慢|speed_slow|擦玻璃|path_flat|随挥|follow-?through|出球发飘/i,
    id: "effect",
    axis: "击球效果",
    labelZh: "击球效果偏弱",
    labelEn: "Weak ball effect",
  },
];

function scoreOf(scores: Record<string, number> | undefined, axis: IssueAxis): number | undefined {
  if (!scores) return undefined;
  const raw = scores[axis] ?? scores[AXIS_META[axis].axisKey];
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Detect issue points from analysis findings + low four-dim scores.
 * Dedupes by id; caps at 4 (matches problem-mark budget).
 */
export function detectIssuePoints(
  findings: string[] = [],
  scores?: Record<string, number> | null,
): IssuePoint[] {
  const out: IssuePoint[] = [];
  const seen = new Set<string>();

  const push = (point: IssuePoint) => {
    if (seen.has(point.id)) return;
    seen.add(point.id);
    out.push(point);
  };

  for (const line of findings || []) {
    const text = String(line || "").trim();
    if (!text) continue;
    for (const rule of ISSUE_RULES) {
      if (!rule.test.test(text)) continue;
      const meta = AXIS_META[rule.axis];
      push({
        id: rule.id,
        axis: rule.axis,
        axisKey: meta.axisKey,
        labelZh: rule.labelZh,
        labelEn: rule.labelEn,
        finding: text,
        score: scoreOf(scores || undefined, rule.axis),
        max: meta.max,
      });
    }
  }

  // Also surface low axis scores even when finding text missed the keyword.
  for (const axis of Object.keys(AXIS_META) as IssueAxis[]) {
    const meta = AXIS_META[axis];
    const score = scoreOf(scores || undefined, axis);
    if (score == null || score > meta.low) continue;
    const already = out.some((p) => p.axis === axis);
    if (already) continue;
    push({
      id: `axis-${meta.axisKey}`,
      axis,
      axisKey: meta.axisKey,
      labelZh: `${meta.labelZh}偏弱`,
      labelEn: `${meta.labelEn} needs work`,
      score,
      max: meta.max,
    });
  }

  return out.slice(0, 4);
}

function coachToStrokeDemo(
  strokeId: string,
  coach: Awaited<ReturnType<typeof fetchCoachLibraryDemo>>,
): StrokeDemoItem | null {
  if (!coach || coach.source !== "coach" || !coach.embedUrl) return null;
  const url = String(coach.embedUrl || coach.videoUrl || "").trim();
  if (!url || url.includes("/tennis/examples/")) return null;
  return {
    id: `coach-${strokeId}-${coach.coachId || "lib"}`,
    strokeId: strokeKeyFrom(strokeId) as StrokeDemoItem["strokeId"],
    title: coach.title || coach.creditZh || "涨球教练",
    source: "coach-provided",
    platform: "in-app",
    clip: url,
    pageUrl: coach.watchUrl || url,
    plays: 0,
    likes: 0,
    coachPick: true,
    credit: coach.creditZh || coach.credit || "涨球教练",
    coachId: coach.coachId,
  };
}

/**
 * Build one correct-action demo per detected issue.
 * Shared video source (coach if selected+published, else star), labeled per issue.
 */
export async function resolveIssueCorrectDemos(opts: {
  strokeId?: string | null;
  title?: string | null;
  findings?: string[];
  scores?: Record<string, number> | null;
  coachId?: string | null;
  locale?: "zh" | "en";
}): Promise<{
  issues: IssuePoint[];
  items: IssueCorrectDemo[];
  source: "star" | "coach";
  loadingError?: string;
}> {
  const strokeId = strokeKeyFrom(opts.strokeId, opts.title);
  const issues = detectIssuePoints(opts.findings || [], opts.scores || undefined);

  let source: "star" | "coach" = "star";
  let baseDemo: StrokeDemoItem = starDemoForStroke(strokeId, opts.title);
  let creditZh = baseDemo.credit || "Star demo";
  let creditEn = baseDemo.credit || "Star demo";
  let loadingError: string | undefined;

  try {
    const coach = await fetchCoachLibraryDemo(strokeId, opts.coachId || undefined);
    const coachDemo = coachToStrokeDemo(strokeId, coach);
    if (coachDemo) {
      source = "coach";
      baseDemo = coachDemo;
      creditZh = coach.creditZh || coach.credit || "涨球教练";
      creditEn = coach.creditEn || coach.credit || "Zhangqiu Coach";
    } else if (coach?.creditZh) {
      creditZh = coach.creditZh;
      creditEn = coach.creditEn || coach.creditZh;
    }
  } catch (err) {
    loadingError = err instanceof Error ? err.message : "demo_resolve_failed";
  }

  // No detected issues → still return one stroke-level card (legacy behavior).
  const effectiveIssues =
    issues.length > 0
      ? issues
      : [
          {
            id: "stroke",
            axis: "击球点" as IssueAxis,
            axisKey: "contact" as IssueAxisKey,
            labelZh: "整体动作",
            labelEn: "Overall form",
          },
        ];

  const items: IssueCorrectDemo[] = effectiveIssues.map((issue) => {
    const demo: StrokeDemoItem = {
      ...baseDemo,
      id: `${baseDemo.id}__${issue.id}`,
      title:
        opts.locale === "en"
          ? `${issue.labelEn} · ${baseDemo.title}`
          : `${issue.labelZh} · ${baseDemo.title}`,
    };
    return {
      issue,
      demo,
      source,
      creditZh,
      creditEn,
      status: demo.clip || demo.pageUrl ? "ready" : "empty",
    };
  });

  return { issues, items, source, loadingError };
}

/** Pure helper for tests / inject scripts (no network). */
export function mapFindingsToIssueIds(findings: string[], scores?: Record<string, number> | null): string[] {
  return detectIssuePoints(findings, scores).map((p) => p.id);
}
