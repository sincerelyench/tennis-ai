#!/usr/bin/env bash
# Restore platform star demos (Sabalenka / Djokovic / …) as default 拍摄示例 / 正确动作.
# Coach library videos only when player selected a published coach with that stroke.
# Brand 涨球; default coach display 涨球教练 (not 掌球 / Poppy / 东东).
# Prefer HD Bilibili embeds; do not use muddy /tennis/examples/*.mp4 as platform refs.
#
# Usage (on 8.216.53.29, or via Mac SSH as root):
#   bash deploy/restore-star-demos/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.restore-star-demos-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -d "$PATCH" ]]; then
  echo "Missing opt-patch at $PATCH" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"
echo "Copying star-demo sources into $ROOT …"

install -d \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/app/api/star-demos" \
  "$ROOT/apps/uniapp/src/lib" \
  "$ROOT/public" \
  "$ROOT/.data"

copy_bak() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    local rel
    rel="$(realpath --relative-to="$ROOT" "$dest" 2>/dev/null || echo "$dest")"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$dest" "$BACKUP/$rel"
  fi
  install -D -m 0644 "$src" "$dest"
  echo "  + $dest"
}

copy_bak "$PATCH/lib/star-demos.ts" "$ROOT/lib/star-demos.ts"
copy_bak "$PATCH/lib/platform-demo.ts" "$ROOT/lib/platform-demo.ts"
copy_bak "$PATCH/lib/demo-catalog.ts" "$ROOT/lib/demo-catalog.ts"
copy_bak "$PATCH/lib/coach-library-analysis-hook.ts" "$ROOT/lib/coach-library-analysis-hook.ts"
copy_bak "$PATCH/components/star-demo-player.tsx" "$ROOT/components/star-demo-player.tsx"
copy_bak "$PATCH/app/api/star-demos/route.ts" "$ROOT/app/api/star-demos/route.ts"
copy_bak "$PATCH/apps/uniapp/src/lib/star-demos.ts" "$ROOT/apps/uniapp/src/lib/star-demos.ts"
cp -v "$PATCH/i18n/messages-star-demos.snippet.ts" "$ROOT/lib/messages-star-demos.snippet.ts"
cp -v "$PATCH/NAV_PATCH.md" "$ROOT/lib/RESTORE_STAR_DEMOS_NAV_PATCH.md"

# Public catalog JSON for ops / H5 fallback (no rebuild required to read).
python3 - "$ROOT/public/star-demos.json" <<'PY'
import json, pathlib, sys
out = pathlib.Path(sys.argv[1])
catalog = {
  "brand": "涨球",
  "defaultCoach": "涨球教练",
  "note": "Platform default = famous stars (HD). Coach demos only when selected published coach has library video.",
  "prefer": "bilibili",
  "strokes": {
    "fh-topspin": {"star": "阿里娜·萨巴伦卡", "starEn": "Aryna Sabalenka", "bilibili": "BV1knqeB4EpG", "youtube": "BZEAu4L3WzQ"},
    "bh-topspin": {"star": "诺瓦克·德约科维奇", "starEn": "Novak Djokovic", "bilibili": "BV1Gy4y1a7zj", "youtube": "6WyMFz4ynl4"},
    "serve": {"star": "皮特·桑普拉斯", "starEn": "Pete Sampras", "bilibili": "BV13t411K7Kw", "youtube": "L_FCXLtUgI8", "quality": "fullhd"},
    "smash": {"star": "小威廉姆斯", "starEn": "Serena Williams", "bilibili": "BV1gF411o7tU", "youtube": "fpxXcyjEUok"},
    "fh-volley": {"star": "罗杰·费德勒", "starEn": "Roger Federer", "youtube": "b2mHhUeeSvc", "note": "YouTube-only; credit matches title"},
    "bh-volley": {"star": "罗杰·费德勒", "starEn": "Roger Federer", "youtube": "oOfUMrsXgjA", "note": "YouTube-only; credit matches title"},
    "fh-slice": {"star": "罗杰·费德勒", "starEn": "Roger Federer", "youtube": "rykbKkywHLw", "note": "YouTube-only; credit matches title"},
    "bh-slice": {"star": "罗杰·费德勒", "starEn": "Roger Federer", "youtube": "sXXM3I9E4E8", "note": "YouTube-only; credit matches title"},
  },
}
out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"  + {out}")
PY

echo
echo "Patching i18n / coach-library lead / display-name strings in source + built chunks…"
python3 - "$ROOT" "$BACKUP" <<'PY'
import pathlib, re, sys, shutil

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
changed = []

PAIR_EXACT = [
  ("掌球教练", "涨球教练"),
  ("Palm Ball Coach", "Zhangqiu Coach"),
  ("学员与分析会优先使用你的材料。", "仅当球员选用你的已发布风格时，分析才用你的示范；平台默认仍是球星高清片。"),
  ("学员与分析会优先使用这里的材料。", "仅当球员选用你的已发布风格时，分析才用你的示范；平台默认仍是球星高清片。"),
  ("Players and analysis prefer your materials.", "Players see your demos only after selecting your published style — platform default stays star HD footage."),
  # Legacy Poppy credit chips must not lead Correct form
  ("Poppy · Forehand: contact first, then speed", "Aryna Sabalenka · Forehand topspin"),
  ("You are 掌球教练", "You are 涨球教练"),
]

# Prefer Bilibili high_quality embeds if old player URLs lack the flag.
BILI_PLAYER_RE = re.compile(
  r"https://player\.bilibili\.com/player\.html\?bvid=(BV[\w]+)([^\"'\s]*)"
)

def backup_file(path: pathlib.Path) -> None:
  try:
    rel = path.relative_to(root)
  except ValueError:
    rel = pathlib.Path("outside") / path.name
  dest = backup / rel
  dest.parent.mkdir(parents=True, exist_ok=True)
  if not dest.exists():
    shutil.copy2(path, dest)


def patch_text(text: str) -> str:
  new = text
  for a, b in PAIR_EXACT:
    new = new.replace(a, b)
  def bili_sub(m: re.Match) -> str:
    bvid, rest = m.group(1), m.group(2) or ""
    if "high_quality=1" in rest:
      return m.group(0)
    # Normalize to HD-preferring embed.
    return f"https://player.bilibili.com/player.html?bvid={bvid}&high_quality=1&danmaku=0&autoplay=0&as_wide=1"
  new = BILI_PLAYER_RE.sub(bili_sub, new)
  return new


globs = [
  "**/messages.ts", "**/messages.js", "**/messages/*.ts", "**/messages/*.json",
  "**/i18n/**/*.ts", "**/i18n/**/*.js", "**/i18n/**/*.json",
  "**/*coach*library*", "**/*demo-catalog*", "**/*star*",
  "**/.next/static/chunks/*.js",
  "**/apps/web/.next/static/chunks/*.js",
  "**/apps/uniapp/**/*.{ts,js,vue}",
  "**/lib/**/*.{ts,js}",
  "**/components/**/*.{ts,tsx,js,jsx}",
  "**/preview/**/*.html",
]

seen = set()
files = []
for pat in globs:
  for p in root.glob(pat):
    if not p.is_file() or p in seen:
      continue
    s = str(p)
    if "/node_modules/" in s or "/.git/" in s:
      continue
    seen.add(p)
    files.append(p)

for p in files:
  try:
    text = p.read_text(encoding="utf-8")
  except Exception:
    continue
  new = patch_text(text)
  if new == text:
    continue
  backup_file(p)
  p.write_text(new, encoding="utf-8")
  changed.append(str(p.relative_to(root)))

print(f"string-patched {len(changed)} files")
for c in changed[:40]:
  print("  ~", c)
if len(changed) > 40:
  print(f"  … +{len(changed)-40} more")
PY

echo
echo "Manual merge still required (see $ROOT/lib/RESTORE_STAR_DEMOS_NAV_PATCH.md):"
echo "  1) Wire StarDemoPlayer / demosForStroke into analyze filming example + report correct form"
echo "  2) Merge lib/messages-star-demos.snippet.ts into i18n messages (en+zh)"
echo "  3) Ensure fetchCoachLibraryDemo uses selectedPublished coach video only — default = stars"
echo "  4) Do NOT fall back filmingExamples to /tennis/examples/*.mp4 for platform refs"
echo
echo "Then:"
echo "  cd $ROOT && npm ci && npm run build && systemctl restart tennis-ai"
echo "Verify: open analyze 拍摄示例 / report 正确动作 — expect Sabalenka/Djokovic/… not unknown coach."
echo "Done copy + string patch. Backup at $BACKUP"
