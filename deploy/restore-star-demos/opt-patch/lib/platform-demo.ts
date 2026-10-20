/**
 * Resolve which demo to show for analyze home / 拍摄示例 / 正确动作.
 *
 * Rules (涨球):
 * 1. Default / platform path → famous star demos (HD Bilibili preferred).
 * 2. Coach-uploaded library video ONLY when the player selected a published
 *    coach AND that coach has a videoUrl for this stroke.
 * 3. Coach prompt text may still inject without replacing the star video.
 */

import {
  preferredEmbed,
  starDemoForStroke,
  starFilmingExample,
  type StarDemo,
  type StarDemoSource,
} from "@/lib/star-demos";

export const BRAND_ZH = "涨球";
export const DEFAULT_COACH_DISPLAY_ZH = "涨球教练";
export const DEFAULT_COACH_DISPLAY_EN = "Zhangqiu Coach";

export type PlatformDemoResult = {
  source: "star" | "coach";
  strokeId: string;
  /** Display credit line. */
  credit: string;
  creditZh: string;
  creditEn: string;
  embedUrl: string;
  watchUrl: string;
  platform: "bilibili" | "youtube" | "coach";
  qualityHint?: string;
  /** Coach prompt only — never forces coach video. */
  prompt: string;
  star?: StarDemo;
  coachId?: string;
  coachName?: string;
};

export type CoachLibraryLookup = {
  coachId: string;
  coachName?: string;
  /** True when player explicitly selected this published coach. */
  selectedPublished: boolean;
  videoUrl?: string;
  prompt?: string;
  title?: string;
};

function isPlayableCoachUrl(url: string | undefined): boolean {
  const u = String(url || "").trim();
  if (!u) return false;
  // Reject empty / placeholder / local muddy examples masquerading as coach demos.
  if (u.includes("/tennis/examples/")) return false;
  return /^(https?:|blob:|\/tennis\/coach-demos\/)/i.test(u);
}

/**
 * Core resolver. Pass coach lookup only when you already know selection state.
 */
export function resolvePlatformDemo(
  strokeId: string,
  coach?: CoachLibraryLookup | null,
  preferBilibili = true,
): PlatformDemoResult {
  const star = starDemoForStroke(strokeId);
  const embed: StarDemoSource = preferredEmbed(star, preferBilibili);

  const useCoachVideo =
    Boolean(coach?.selectedPublished) && isPlayableCoachUrl(coach?.videoUrl);

  if (useCoachVideo && coach) {
    const name = (coach.coachName || DEFAULT_COACH_DISPLAY_ZH).trim();
    const title = (coach.title || "").trim();
    return {
      source: "coach",
      strokeId: star.strokeId,
      credit: title ? `${name} · ${title}` : name,
      creditZh: title ? `${name} · ${title}` : name,
      creditEn: title ? `${name} · ${title}` : name,
      embedUrl: coach.videoUrl!.trim(),
      watchUrl: coach.videoUrl!.trim(),
      platform: "coach",
      prompt: (coach.prompt || "").trim(),
      coachId: coach.coachId,
      coachName: name,
      star,
    };
  }

  return {
    source: "star",
    strokeId: star.strokeId,
    credit: `${star.nameEn} · ${star.strokeLabelEn}`,
    creditZh: `${star.nameZh} · ${star.strokeLabelZh}`,
    creditEn: `${star.nameEn} · ${star.strokeLabelEn}`,
    embedUrl: embed.embedUrl,
    watchUrl: embed.watchUrl,
    platform: embed.platform,
    qualityHint: embed.qualityHint,
    prompt: (coach?.prompt || "").trim(),
    star,
    coachId: coach?.coachId,
    coachName: coach?.coachName,
  };
}

/** Drop-in replacement for filmingExamples[stroke] on analyze / home. */
export function platformFilmingExample(strokeId: string, preferBilibili = true) {
  return starFilmingExample(strokeId, preferBilibili);
}
