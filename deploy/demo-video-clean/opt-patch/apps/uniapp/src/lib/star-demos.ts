/**
 * Uni-app / H5 mirror of platform star demos (涨球).
 * Prefer Bilibili embeds in CN WebView.
 */

export type StarDemoStrokeId =
  | "fh-topspin"
  | "fh-slice"
  | "fh-volley"
  | "bh-topspin"
  | "bh-slice"
  | "bh-volley"
  | "serve"
  | "smash";

const CATALOG: Record<
  StarDemoStrokeId,
  {
    nameZh: string;
    nameEn: string;
    bili?: string;
    youtube: string;
  }
> = {
  "fh-topspin": {
    nameZh: "阿里娜·萨巴伦卡",
    nameEn: "Aryna Sabalenka",
    bili: "BV1knqeB4EpG",
    youtube: "BZEAu4L3WzQ",
  },
  "bh-topspin": {
    nameZh: "诺瓦克·德约科维奇",
    nameEn: "Novak Djokovic",
    bili: "BV1Gy4y1a7zj",
    youtube: "6WyMFz4ynl4",
  },
  serve: {
    nameZh: "皮特·桑普拉斯",
    nameEn: "Pete Sampras",
    bili: "BV13t411K7Kw",
    youtube: "L_FCXLtUgI8",
  },
  smash: {
    nameZh: "小威廉姆斯",
    nameEn: "Serena Williams",
    bili: "BV1gF411o7tU",
    youtube: "fpxXcyjEUok",
  },
  "fh-volley": {
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    youtube: "b2mHhUeeSvc",
  },
  "bh-volley": {
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    youtube: "oOfUMrsXgjA",
  },
  "fh-slice": {
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    youtube: "rykbKkywHLw",
  },
  "bh-slice": {
    nameZh: "罗杰·费德勒",
    nameEn: "Roger Federer",
    youtube: "sXXM3I9E4E8",
  },
};

function normalize(id: string): StarDemoStrokeId {
  const k = String(id || "").toLowerCase();
  if (k in CATALOG) return k as StarDemoStrokeId;
  if (/serve/.test(k)) return "serve";
  if (/smash|overhead/.test(k)) return "smash";
  if (/bh.*volley|backhand.*volley/.test(k)) return "bh-volley";
  if (/fh.*volley|forehand.*volley/.test(k)) return "fh-volley";
  if (/bh.*slice|backhand.*slice/.test(k)) return "bh-slice";
  if (/fh.*slice|forehand.*slice/.test(k)) return "fh-slice";
  if (/bh|backhand/.test(k)) return "bh-topspin";
  return "fh-topspin";
}

export function starDemoForStroke(strokeId: string, preferBilibili = true) {
  const id = normalize(strokeId);
  const row = CATALOG[id];
  const useBili = preferBilibili && row.bili;
  const embedUrl = useBili
    ? `https://player.bilibili.com/player.html?bvid=${row.bili}&high_quality=1&danmaku=0&autoplay=0&as_wide=1`
    : `https://www.youtube-nocookie.com/embed/${row.youtube}?rel=0&modestbranding=1`;
  const watchUrl = useBili
    ? `https://www.bilibili.com/video/${row.bili}/`
    : `https://www.youtube.com/watch?v=${row.youtube}`;
  return {
    strokeId: id,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    platform: useBili ? "bilibili" : "youtube",
    embedUrl,
    watchUrl,
    // Never /tennis/examples/*.mp4 (unknown coach muddy 640×480).
  };
}
