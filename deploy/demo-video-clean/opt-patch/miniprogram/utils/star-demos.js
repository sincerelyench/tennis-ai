/**
 * 涨球 miniprogram star demos — embed URLs only (no credit / source-switch UI).
 * Prefer Bilibili HD; Federer strokes YouTube-only.
 */
const CATALOG = {
  "fh-topspin": { bili: "BV1knqeB4EpG", youtube: "BZEAu4L3WzQ" },
  "bh-topspin": { bili: "BV1Gy4y1a7zj", youtube: "6WyMFz4ynl4" },
  serve: { bili: "BV13t411K7Kw", youtube: "L_FCXLtUgI8" },
  smash: { bili: "BV1gF411o7tU", youtube: "fpxXcyjEUok" },
  "fh-volley": { youtube: "b2mHhUeeSvc" },
  "bh-volley": { youtube: "oOfUMrsXgjA" },
  "fh-slice": { youtube: "rykbKkywHLw" },
  "bh-slice": { youtube: "sXXM3I9E4E8" },
};

function normalize(id) {
  const k = String(id || "").toLowerCase();
  if (CATALOG[k]) return k;
  if (/serve/.test(k)) return "serve";
  if (/smash|overhead/.test(k)) return "smash";
  if (/bh.*volley|backhand.*volley/.test(k)) return "bh-volley";
  if (/fh.*volley|forehand.*volley/.test(k)) return "fh-volley";
  if (/bh.*slice|backhand.*slice/.test(k)) return "bh-slice";
  if (/fh.*slice|forehand.*slice/.test(k)) return "fh-slice";
  if (/bh|backhand/.test(k)) return "bh-topspin";
  if (/forehand|fh/.test(k)) return "fh-topspin";
  return "fh-topspin";
}

function starDemoForStroke(strokeId, preferBilibili) {
  const prefer = preferBilibili !== false;
  const id = normalize(strokeId);
  const row = CATALOG[id];
  const useBili = prefer && row.bili;
  const embedUrl = useBili
    ? `https://player.bilibili.com/player.html?bvid=${row.bili}&high_quality=1&danmaku=0&autoplay=0&as_wide=1`
    : `https://www.youtube-nocookie.com/embed/${row.youtube}?rel=0&modestbranding=1`;
  return { strokeId: id, embedUrl, platform: useBili ? "bilibili" : "youtube" };
}

module.exports = { starDemoForStroke, normalize };
