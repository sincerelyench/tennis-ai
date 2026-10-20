#!/usr/bin/env bash
# 涨球 · clean demo chrome — apply on 8.216.53.29 (/opt/tennis-ai)
# Surfaces: Next web + uni-app (APK H5 / iOS www) + mp-weixin sources.
# Also strips credit/换源 chrome from published tennis-ai.apk / .ipa JS when present.
#
# Usage:
#   bash deploy/demo-video-clean/scripts/apply-on-server.sh /opt/tennis-ai
# Prefer Mac wrapper: scripts/mac-four-surface-release.sh
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.demo-video-clean-backup-${STAMP}"
APK_DIR="${APK_DIR:-/var/www/apk}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/star-demo-player.tsx" ]]; then
  echo "Missing clean player at $PATCH/components/star-demo-player.tsx" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"
echo "==> 1/5 Next + uni-app + miniprogram source drop-in"

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

install -d \
  "$ROOT/components" \
  "$ROOT/lib" \
  "$ROOT/public" \
  "$ROOT/apps/uniapp/src/components" \
  "$ROOT/apps/uniapp/src/lib" \
  "$ROOT/apps/uniapp/src/pages/star-demo-embed" \
  "$ROOT/miniprogram/utils" \
  "$ROOT/miniprogram/pages/star-demo-embed"

copy_bak "$PATCH/components/star-demo-player.tsx" "$ROOT/components/star-demo-player.tsx"
copy_bak "$PATCH/apps/uniapp/src/components/star-demo-player.vue" \
  "$ROOT/apps/uniapp/src/components/star-demo-player.vue"
copy_bak "$PATCH/apps/uniapp/src/lib/star-demos.ts" \
  "$ROOT/apps/uniapp/src/lib/star-demos.ts"
copy_bak "$PATCH/apps/uniapp/src/pages/star-demo-embed/star-demo-embed.vue" \
  "$ROOT/apps/uniapp/src/pages/star-demo-embed/star-demo-embed.vue"
copy_bak "$PATCH/miniprogram/utils/star-demos.js" "$ROOT/miniprogram/utils/star-demos.js"
copy_bak "$PATCH/miniprogram/pages/star-demo-embed/star-demo-embed.js" \
  "$ROOT/miniprogram/pages/star-demo-embed/star-demo-embed.js"
copy_bak "$PATCH/miniprogram/pages/star-demo-embed/star-demo-embed.wxml" \
  "$ROOT/miniprogram/pages/star-demo-embed/star-demo-embed.wxml"
copy_bak "$PATCH/miniprogram/pages/star-demo-embed/star-demo-embed.json" \
  "$ROOT/miniprogram/pages/star-demo-embed/star-demo-embed.json"
cp -v "$PATCH/lib/CLEAN_DEMO_NAV.md" "$ROOT/lib/CLEAN_DEMO_NAV.md"

# Thin-repo miniprogram mirror (workspace checkout on server if present)
if [[ -d "$ROOT/../miniprogram" ]]; then
  :
fi
# Also drop into /opt/tennis-ai sibling checkout paths used by ship scripts
for MP_ROOT in "$ROOT/apps/uniapp/dist/build/mp-weixin" "$ROOT/miniprogram"; do
  if [[ -d "$MP_ROOT" ]]; then
    install -d "$MP_ROOT/utils" "$MP_ROOT/pages/star-demo-embed"
    cp -f "$PATCH/miniprogram/utils/star-demos.js" "$MP_ROOT/utils/star-demos.js" 2>/dev/null || true
    cp -f "$PATCH/miniprogram/pages/star-demo-embed/"* "$MP_ROOT/pages/star-demo-embed/" 2>/dev/null || true
  fi
done

# Register embed page in pages.json / app.json when missing
python3 - "$ROOT" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
page = "pages/star-demo-embed/star-demo-embed"

def ensure_pages_json(path: pathlib.Path, key_path=None):
  if not path.is_file():
    return
  try:
    data = json.loads(path.read_text(encoding="utf-8"))
  except Exception as e:
    print(f"  ! skip {path}: {e}")
    return
  pages = data.get("pages")
  if not isinstance(pages, list):
    return
  # uni-app: pages may be strings or {path: ...}
  def has_page():
    for p in pages:
      if p == page or p == f"/{page}":
        return True
      if isinstance(p, dict) and p.get("path") in (page, f"/{page}"):
        return True
    return False
  if has_page():
    print(f"  · already registered: {path}")
    return
  pages.append(page)
  data["pages"] = pages
  path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  print(f"  + registered {page} in {path}")

for cand in [
  root / "apps/uniapp/src/pages.json",
  root / "apps/uniapp/pages.json",
  root / "miniprogram/app.json",
  root / "apps/uniapp/dist/build/mp-weixin/app.json",
]:
  ensure_pages_json(cand)
PY

# Public preview
python3 - "$ROOT/public/demo-video-clean-preview.html" <<'PY'
from pathlib import Path
import sys
out = Path(sys.argv[1])
out.write_text("""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>涨球 · 干净示范预览</title>
  <style>
    body { margin: 0; font-family: "PingFang SC", "Noto Sans SC", sans-serif; background: linear-gradient(160deg, #ecfeff, #f8fafc 55%); color: #0f172a; }
    header { padding: 1rem 1.25rem; display: flex; align-items: center; gap: .6rem; }
    .mark { width: 28px; height: 28px; border-radius: 8px; background: #0d9488; }
    h1 { font-size: 1.15rem; margin: 0; }
    main { max-width: 720px; margin: 0 auto; padding: 0 1rem 2rem; }
    label { display: block; font-size: .85rem; color: #334155; margin: 1rem 0 .35rem; }
    select { width: 100%; padding: .65rem .75rem; border-radius: 10px; border: 1px solid #99f6e4; background: #fff; font-size: 1rem; }
    .frame { position: relative; padding-top: 56.25%; margin-top: 1rem; border-radius: 12px; overflow: hidden; background: #0b1220; }
    .frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    p.note { font-size: .8rem; color: #64748b; margin-top: 1rem; }
  </style>
</head>
<body>
  <header><div class="mark"></div><h1>涨球</h1></header>
  <main>
    <label for="stroke">技术</label>
    <select id="stroke">
      <option value="BV1knqeB4EpG">正手上旋</option>
      <option value="BV1Gy4y1a7zj">反手上旋</option>
      <option value="BV13t411K7Kw">发球</option>
    </select>
    <div class="frame" data-clean-demo="1">
      <iframe id="player" title="示范" allowfullscreen
        src="https://player.bilibili.com/player.html?bvid=BV1knqeB4EpG&high_quality=1&danmaku=0&autoplay=0&as_wide=1"></iframe>
    </div>
    <p class="note">干净预览：无署名、无原页链接、无源切换。平台 iframe 内置角标可能仍在，非涨球 UI。</p>
  </main>
  <script>
    const sel = document.getElementById('stroke');
    const iframe = document.getElementById('player');
    sel.addEventListener('change', () => {
      iframe.src = 'https://player.bilibili.com/player.html?bvid=' + sel.value + '&high_quality=1&danmaku=0&autoplay=0&as_wide=1';
    });
  </script>
</body>
</html>
""", encoding="utf-8")
print(f"  + {out}")
PY

echo
echo "==> 2/5 Strip credit / source-switch chrome from UI sources + chunks"
python3 - "$ROOT" "$BACKUP" <<'PY'
import pathlib, re, shutil, sys

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
changed = []

DROP_EXACT = [
  "打开B站原页（高清）",
  "打开B站原页",
  "换源 · YouTube",
  "换源 · B站",
  "换源·YouTube",
  "Open original on Bilibili (HD)",
  "Open original on YouTube (HD)",
  "Open original on Bilibili",
  "Switch · YouTube",
  "Switch · Bilibili",
  "进入哔哩哔哩，观看更高清 >",
  "进入哔哩哔哩，观看更高清",
]

CREDIT_RE = re.compile(
  r"(阿里娜·萨巴伦卡|诺瓦克·德约科维奇|皮特·桑普拉斯|罗杰·费德勒|小威廉姆斯"
  r"|Aryna Sabalenka|Novak Djokovic|Pete Sampras|Roger Federer|Serena Williams)"
  r"\s*·\s*[^\n\"'<>]{2,32}\s*·\s*(HD|FULLHD|SLOWMO|4K)",
  re.I,
)
STAR_CREDIT_JSX = re.compile(
  r'<div[^>]*className=\{?["\']star-demo-credit["\']\}?[^>]*>[\s\S]*?</div>',
  re.M,
)
STAR_ACTIONS_JSX = re.compile(
  r'<div[^>]*className=\{?["\']star-demo-actions["\']\}?[^>]*>[\s\S]*?</div>',
  re.M,
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


def scrub(text: str, path: pathlib.Path) -> str:
  new = text
  for s in DROP_EXACT:
    new = new.replace(s, "")
  new = STAR_CREDIT_JSX.sub("", new)
  new = STAR_ACTIONS_JSX.sub("", new)
  name = path.name
  if name not in {"star-demos.ts", "star-demos.js", "star-demos.json", "route.ts"} and "star-demos" not in name:
    new = CREDIT_RE.sub("", new)
  return new


globs = [
  "components/star-demo-player.tsx",
  "components/**/*demo*",
  "components/**/*analysis*",
  "components/**/*filming*",
  "app/**/*analysis*",
  "**/analysis-view*",
  "**/filming*",
  "**/*star-demo*",
  "apps/uniapp/src/**/*.{vue,ts,js}",
  "apps/uniapp/dist/**/*.{js,json,html,vue}",
  "miniprogram/**/*.{js,wxml,json}",
  "**/.next/static/chunks/*.js",
  "**/apps/web/.next/static/chunks/*.js",
  "**/preview/**/*.html",
  "public/**/*.html",
]

seen = set()
files = []
for pat in globs:
  for p in root.glob(pat):
    if not p.is_file() or p in seen:
      continue
    if "node_modules" in p.parts or ".git" in p.parts:
      continue
    if any(part.startswith(".demo-video-clean-backup-") or part.startswith(".restore-star-demos-backup-") for part in p.parts):
      continue
    if p.name in {"star-demos.json", "star-demos.ts", "star-demos.js", "demo-video-clean-preview.html", "CLEAN_DEMO_NAV.md"}:
      continue
    seen.add(p)
    files.append(p)

for p in files:
  try:
    text = p.read_text(encoding="utf-8")
  except Exception:
    continue
  new = scrub(text, p)
  if new == text:
    continue
  backup_file(p)
  p.write_text(new, encoding="utf-8")
  changed.append(str(p.relative_to(root)))

print(f"chrome-stripped {len(changed)} files")
for c in changed[:50]:
  print("  ~", c)
if len(changed) > 50:
  print(f"  … +{len(changed) - 50} more")
PY

echo
echo "==> 3/5 Patch tennis-ai.apk / tennis-ai.ipa embedded JS (APK H5 + iOS www)"
python3 - "$ROOT" "$BACKUP" <<'PY'
import io, pathlib, shutil, sys, zipfile

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])

DROP = [
  "打开B站原页（高清）",
  "打开B站原页",
  "换源 · YouTube",
  "换源 · B站",
  "Open original on Bilibili (HD)",
  "Open original on YouTube (HD)",
  "Switch · YouTube",
  "Switch · Bilibili",
  "进入哔哩哔哩，观看更高清 >",
  "进入哔哩哔哩，观看更高清",
  "star-demo-credit",
  "star-demo-actions",
]

candidates = []
for base in (pathlib.Path("/var/www/apk"), pathlib.Path("/usr/share/nginx/html"), pathlib.Path("/var/www"), pathlib.Path("/www/wwwroot"), root / "public", root):
  if not base.exists():
    continue
  candidates.extend(base.glob("**/tennis-ai.apk"))
  candidates.extend(base.glob("**/tennis-ai.ipa"))

seen = set()
patched = []

def backup_file(path: pathlib.Path) -> None:
  try:
    rel = path.relative_to(root)
  except ValueError:
    rel = pathlib.Path("_outside") / path.name
  dest = backup / rel
  dest.parent.mkdir(parents=True, exist_ok=True)
  if not dest.exists():
    shutil.copy2(path, dest)

for archive in candidates:
  if not archive.is_file() or archive in seen:
    continue
  seen.add(archive)
  try:
    zin = zipfile.ZipFile(archive, "r")
  except Exception as e:
    print(f"  ! skip {archive}: {e}")
    continue
  names = [n for n in zin.namelist() if n.endswith((".js", ".json", ".html", ".vue", ".wxml", ".txt"))]
  updates = {}
  for n in names:
    try:
      text = zin.read(n).decode("utf-8")
    except Exception:
      continue
    new = text
    for s in DROP:
      new = new.replace(s, "")
    if new != text:
      updates[n] = new.encode("utf-8")
  if not updates:
    zin.close()
    continue
  backup_file(archive)
  buf = io.BytesIO()
  with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
      data = updates.get(item.filename, zin.read(item.filename))
      zout.writestr(item, data)
  zin.close()
  archive.write_bytes(buf.getvalue())
  try:
    archive.chmod(0o644)
  except Exception:
    pass
  patched.append(f"{archive} ({len(updates)} entries)")

print(f"archives patched: {len(patched)}")
for a in patched:
  print("  apk/ipa:", a)
if not patched:
  print("  (no APK/IPA chrome hits — rebuild+upload from Mac if clients still show credit)")
PY

echo
echo "==> 4/5 Rebuild Next web"
if id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
else
  (cd "$ROOT" && npm run build)
fi

if systemctl list-unit-files tennis-ai.service >/dev/null 2>&1; then
  systemctl restart tennis-ai
  systemctl --no-pager --full status tennis-ai | head -15
fi

echo
echo "==> 5/5 Rebuild mp-weixin.zip when uni-app toolchain present"
MP_OUT=""
UNIAPP="$ROOT/apps/uniapp"
if [[ -d "$UNIAPP" ]]; then
  if command -v npx >/dev/null 2>&1; then
    (
      cd "$UNIAPP"
      # Best-effort; Mac may rebuild with HBuilderX if this fails.
      npx --yes @dcloudio/uvm@latest >/dev/null 2>&1 || true
      if npm run build:mp-weixin 2>/tmp/zq-mp-build.log; then
        echo "  uni build:mp-weixin ok"
      elif npx uni build -p mp-weixin 2>>/tmp/zq-mp-build.log; then
        echo "  npx uni build -p mp-weixin ok"
      else
        echo "  ! uni mp-weixin build skipped (see /tmp/zq-mp-build.log); Mac should rebuild"
      fi
    ) || true
  fi
  for d in \
    "$UNIAPP/dist/build/mp-weixin" \
    "$UNIAPP/dist/dev/mp-weixin" \
    "$ROOT/miniprogram"
  do
    if [[ -f "$d/app.json" ]]; then
      MP_OUT="$d"
      break
    fi
  done
fi

if [[ -n "$MP_OUT" ]]; then
  mkdir -p "$APK_DIR"
  ZIP="$APK_DIR/mp-weixin.zip"
  TMP_ZIP="/tmp/mp-weixin-clean-${STAMP}.zip"
  (cd "$MP_OUT" && zip -qr "$TMP_ZIP" .)
  install -m 0644 "$TMP_ZIP" "$ZIP"
  echo "  + $ZIP ($(wc -c < "$ZIP" | tr -d ' ') bytes from $MP_OUT)"
  # README touch
  if [[ ! -f "$APK_DIR/mp-weixin-README.txt" ]]; then
    cat > "$APK_DIR/mp-weixin-README.txt" <<'EOF'
涨球微信小程序包
1. 解压 mp-weixin.zip
2. 微信开发者工具导入该目录（touristappid 或正式 AppID）
3. 勾选不校验合法域名
示范视频仅播放画面，无署名/换源入口。
EOF
    chmod 644 "$APK_DIR/mp-weixin-README.txt"
  fi
else
  echo "  ! no mp-weixin dist to zip — Mac: rebuild uni-app mp-weixin and upload"
fi

if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  systemctl reload nginx || true
fi

echo
echo "Done. Backup $BACKUP"
echo "Verify four surfaces:"
echo "  Web  https://yqchen.blog/tennis/analysis/new  (technique + video only)"
echo "  APK  https://yqchen.blog/tennis-ai.apk"
echo "  IPA  https://yqchen.blog/tennis-ai.ipa"
echo "  MP   https://yqchen.blog/mp-weixin.zip"
echo "Preview: /tennis/demo-video-clean-preview.html"
