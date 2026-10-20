/**
 * Platform default reference demos = famous tennis stars (涨球).
 * Prefer playable Bilibili embeds in CN; YouTube as original / fallback.
 * Prefer HD / Full HD / 4K sources — never muddy in-app coach mp4s.
 *
 * Coach-uploaded library clips are separate: only use them when the player
 * explicitly selected a published coach that has that stroke's video.
 */

export type StarKey = "sabalenka" | "djokovic" | "federer" | "sampras" | "serena";

export type StarDemoStrokeId =
  | "fh-topspin"
  | "fh-slice"
  | "fh-volley"
  | "bh-topspin"
  | "bh-slice"
  | "bh-volley"
  | "serve"
  | "smash";

export type StarDemoSource = {
  platform: "bilibili" | "youtube";
  /** Watch page URL (open original). */
  watchUrl: string;
  /** Embeddable player URL (Bilibili player.html or YouTube nocookie). */
  embedUrl: string;
  /** Optional note: fullhd / 4k / slowmo — for ops / QA. */
  qualityHint?: "fullhd" | "hd" | "4k" | "slowmo";
};

export type StarDemo = {
  strokeId: StarDemoStrokeId;
  starKey: StarKey;
  /** i18n key under star.* */
  nameKey: `star.${StarKey}`;
  /** Chinese display fallback (UI should prefer i18n). */
  nameZh: string;
  nameEn: string;
  strokeLabelZh: string;
  strokeLabelEn: string;
  /** CN-first: Bilibili when present, else YouTube. */
  primary: StarDemoSource;
  /** Alternate platform (usually YouTube when primary is Bilibili). */
  secondary?: StarDemoSource;
};

function bili(bvid: string, qualityHint: StarDemoSource["qualityHint"] = "hd"): StarDemoSource {
  return {
    platform: "bilibili",
    watchUrl: `https://www.bilibili.com/video/${bvid}/`,
    // high_quality=1 nudges clearer playback in the embed where allowed.
    embedUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&high_quality=1&danmaku=0&autoplay=0&as_wide=1`,
    qualityHint,
  };
}

function yt(videoId: string, qualityHint: StarDemoSource["qualityHint"] = "hd"): StarDemoSource {
  return {
    platform: "youtube",
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
    qualityHint,
  };
}

/**
 * Star catalog restored from 2026-10-16/17 (credit matches watch-page title).
 * Bilibili preferred for CN WebView; YouTube verified via oembed.
 * Prefer Full HD / slow-mo technique clips over soft generic coach footage.
 */
export const STAR_DEMOS: Record<StarDemoStrokeId, StarDemo> = {
  "fh-topspin": {
    strokeId: "fh-topspin",
    starKey: "sabalenka",
    nameKey: "star.sabalenka",
    nameZh: "阿里娜·萨巴伦卡",
    nameEn: "Aryna Sabalenka",
    strokeLabelZh: "正手上旋",
    strokeLabelEn: "Forehand topspin",
    // 「阿里亚西姆」→ Sabalenka (Aryna). Prior: BV1knqeB4EpG + YT BZEAu4L3WzQ.
    primary: bili("BV1knqeB4EpG", "hd"),
    secondary: yt("BZEAu4L3WzQ", "hd"),
  },
  "bh-topspin": {
    strokeId: "bh-topspin",
    starKey: "djokovic",
    nameKey: "star.djokovic",
    nameZh: "诺瓦克·德约科维奇",
    nameEn: "Novak Djokovic",
    strokeLabelZh: "反手上旋",
    strokeLabelEn: "Backhand topspin",
    primary: bili("BV1Gy4y1a7zj", "slowmo"),
    secondary: yt("6WyMFz4ynl4", "slowmo"),
  },
  serve: {
    strokeId: "serve",
    starKey: "sampras",
    nameKey: "star.sampras",
    nameZh: "皮特·桑普拉斯",
    nameEn: "Pete Sampras",
    strokeLabelZh: "发球",
    strokeLabelEn: "Serve",
    // YouTube title: "Pete Sampras Serve Full HD Slow Motion"
    primary: bili("BV13t411K7Kw", "fullhd"),
    secondary: yt("L_FCXLtUgI8", "fullhd"),
  },
  smash: {
    strokeId: "smash",
    starKey: "serena",
    nameKey: "star.serena",
    nameZh: "小威廉姆斯",
    nameEn: "Serena Williams",
    strokeLabelZh: "高压球",
    strokeLabelEn: "Overhead smash",
    primary: bili("BV1gF411o7tU", "hd"),
    secondary: yt("fpxXcyjEUok", "hd"),
  },
  // Federer volley/slice: YouTube only (credit matches watch title). Prior
  // Bilibili "community" BVIDs were generic and broke star attribution.
  "fh-volley": {
    strokeId: "fh-volley",
    starKey: "federer",
    nameKey: "star.federer",
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    strokeLabelZh: "正手截击",
    strokeLabelEn: "Forehand volley",
    primary: yt("b2mHhUeeSvc", "slowmo"),
  },
  "bh-volley": {
    strokeId: "bh-volley",
    starKey: "federer",
    nameKey: "star.federer",
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    strokeLabelZh: "反手截击",
    strokeLabelEn: "Backhand volley",
    primary: yt("oOfUMrsXgjA", "hd"),
  },
  "fh-slice": {
    strokeId: "fh-slice",
    starKey: "federer",
    nameKey: "star.federer",
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    strokeLabelZh: "正手切削",
    strokeLabelEn: "Forehand slice",
    primary: yt("rykbKkywHLw", "hd"),
  },
  "bh-slice": {
    strokeId: "bh-slice",
    starKey: "federer",
    nameKey: "star.federer",
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    strokeLabelZh: "反手切削",
    strokeLabelEn: "Backhand slice",
    primary: yt("sXXM3I9E4E8", "slowmo"),
  },
};

const STROKE_ALIASES: Record<string, StarDemoStrokeId> = {
  "fh-topspin": "fh-topspin",
  forehand: "fh-topspin",
  "forehand-topspin": "fh-topspin",
  "fh-slice": "fh-slice",
  "forehand-slice": "fh-slice",
  "fh-volley": "fh-volley",
  "forehand-volley": "fh-volley",
  "bh-topspin": "bh-topspin",
  backhand: "bh-topspin",
  "backhand-topspin": "bh-topspin",
  "bh-slice": "bh-slice",
  "backhand-slice": "bh-slice",
  "bh-volley": "bh-volley",
  "backhand-volley": "bh-volley",
  serve: "serve",
  smash: "smash",
  overhead: "smash",
};

export function normalizeStrokeId(strokeId: string): StarDemoStrokeId {
  const key = String(strokeId || "")
    .trim()
    .toLowerCase();
  return STROKE_ALIASES[key] || "fh-topspin";
}

export function starDemoForStroke(strokeId: string): StarDemo {
  return STAR_DEMOS[normalizeStrokeId(strokeId)];
}

/** Prefer Bilibili when present (CN / WebView); else primary. */
export function preferredEmbed(demo: StarDemo, preferBilibili = true): StarDemoSource {
  if (preferBilibili) {
    if (demo.primary.platform === "bilibili") return demo.primary;
    if (demo.secondary?.platform === "bilibili") return demo.secondary;
  }
  return demo.primary;
}

export function alternateSource(demo: StarDemo, current: StarDemoSource): StarDemoSource | null {
  if (!demo.secondary) return null;
  if (current.platform === demo.primary.platform) return demo.secondary;
  return demo.primary;
}

/** Shape used by filming-example / correct-form UI (replaces muddy /tennis/examples/*.mp4). */
export function starFilmingExample(strokeId: string, preferBilibili = true) {
  const demo = starDemoForStroke(strokeId);
  const src = preferredEmbed(demo, preferBilibili);
  return {
    id: demo.strokeId,
    kind: "star" as const,
    starKey: demo.starKey,
    nameKey: demo.nameKey,
    nameZh: demo.nameZh,
    nameEn: demo.nameEn,
    label: demo.strokeLabelEn,
    labelZh: demo.strokeLabelZh,
    platform: src.platform,
    embedUrl: src.embedUrl,
    watchUrl: src.watchUrl,
    qualityHint: src.qualityHint || "hd",
    // Do NOT point at /tennis/examples/*.mp4 (unknown coach, 640×480 muddy).
    video: src.embedUrl,
    poster: "",
  };
}

export function listStarDemos(): StarDemo[] {
  return Object.values(STAR_DEMOS);
}
