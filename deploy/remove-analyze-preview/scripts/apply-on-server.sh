#!/usr/bin/env bash
# 涨球 · remove 分析预览 — apply on 8.216.53.29 (/opt/tennis-ai)
# Surfaces: Next web + uni-app (APK H5 / iOS www) + mp-weixin sources.
# Also strips 分析预览 / analysis preview chrome from published tennis-ai.apk / .ipa JS.
# Keeps: analyze progress roadmap, report, demos, coach selection, E1 auth hotfix.
#
# Usage:
#   bash deploy/remove-analyze-preview/scripts/apply-on-server.sh /opt/tennis-ai
# Prefer Mac wrapper: scripts/mac-four-surface-release.sh
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
UNI="$HERE/uniapp-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.remove-analyze-preview-backup-${STAMP}"
APK_DIR="${APK_DIR:-/var/www/apk}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/analyze-progress.tsx" ]]; then
  echo "Missing $PATCH/components/analyze-progress.tsx" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"
echo "==> 1/5 Next + uni-app source drop-in"

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
  "$ROOT/apps/uniapp/src/pages"

copy_bak "$PATCH/components/analyze-progress.tsx" "$ROOT/components/analyze-progress.tsx"
# Merge helpers only if roadmap helpers missing; never wipe JobProgressFields / displayProgress
if [[ -f "$ROOT/lib/job-progress.ts" ]]; then
  if ! grep -q 'mergedSteps\|PIPELINE_STEPS\|leaveHint' "$ROOT/lib/job-progress.ts" 2>/dev/null; then
    copy_bak "$PATCH/lib/job-progress.ts" "$ROOT/lib/job-progress.ts"
  else
    echo "  · kept existing lib/job-progress.ts (has roadmap helpers)"
  fi
else
  copy_bak "$PATCH/lib/job-progress.ts" "$ROOT/lib/job-progress.ts"
fi
copy_bak "$PATCH/i18n/messages-analyze-progress.snippet.ts" \
  "$ROOT/lib/messages-analyze-progress.snippet.ts"
copy_bak "$PATCH/ANALYSIS_VIEW_PATCH.md" "$ROOT/lib/REMOVE_ANALYZE_PREVIEW.md"
copy_bak "$UNI/progress-roadmap.snippet.vue" \
  "$ROOT/apps/uniapp/src/components/zq-analyze-progress.vue"

echo
echo "==> 2/5 Scrub 分析预览 copy from Next / uni-app / mp sources + i18n"

python3 - "$ROOT" "$BACKUP" <<'PY'
import pathlib, re, shutil, sys

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
changed = []

DROP_EXACT = [
  "分析预览",
  "Analysis preview",
  "上传后这里会显示你的录像预览",
  "Your clip preview will show up here after upload",
]

# JSX/Vue block that is only the preview card (best-effort)
PREVIEW_CARD_RE = re.compile(
  r'<div[^>]*className=\{?["\']zq-ap-card["\']\}?[^>]*>\s*'
  r'<h3[^>]*>\s*分析预览\s*</h3>[\s\S]*?</div>\s*',
  re.M,
)
PREVIEW_CARD_VUE = re.compile(
  r'<view[^>]*class=["\']zq-ap-card["\'][^>]*>\s*'
  r'<text[^>]*class=["\']zq-ap-h3["\'][^>]*>\s*分析预览\s*</text>[\s\S]*?</view>\s*',
  re.M,
)
I18N_PREVIEW = re.compile(
  r'[,{]\s*preview\s*:\s*["\'](?:分析预览|Preview|Analysis preview)["\']\s*',
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


def scrub(text: str) -> str:
  new = PREVIEW_CARD_RE.sub("", text)
  new = PREVIEW_CARD_VUE.sub("", new)
  new = I18N_PREVIEW.sub(lambda m: m.group(0)[0] if m.group(0)[0] in "{," else "", new)
  # Clean dangling commas in objects from key removal (light touch)
  new = re.sub(r',\s*,', ',', new)
  new = re.sub(r'\{\s*,', '{', new)
  new = re.sub(r',\s*}', '}', new)
  for s in DROP_EXACT:
    new = new.replace(s, "")
  # Remove empty preview CSS blocks that only serve the waiting card (optional)
  return new


globs = [
  "components/analyze-progress.tsx",
  "components/**/*analyze*",
  "components/**/*progress*",
  "lib/**/*messages*",
  "lib/**/*i18n*",
  "**/analysis-view*",
  "**/reports-view*",
  "apps/uniapp/src/**/*.{vue,ts,js}",
  "apps/uniapp/dist/**/*.{js,json,html,vue}",
  "miniprogram/**/*.{js,wxml,json,ts}",
  "i18n/**/*.ts",
  "i18n/**/*.json",
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
    if any(
      part.startswith(".remove-analyze-preview-backup-")
      or part.startswith(".analyze-progress-ui-backup-")
      for part in p.parts
    ):
      continue
    # Do not scrub brand / coach / report
    if p.name in {"REMOVE_ANALYZE_PREVIEW.md", "ANALYSIS_VIEW_PATCH.md"}:
      continue
    seen.add(p)
    files.append(p)

for p in files:
  try:
    text = p.read_text(encoding="utf-8")
  except Exception:
    continue
  # Never wipe our new component (already correct)
  if p.name == "analyze-progress.tsx" and 'data-no-analyze-preview="1"' in text:
    continue
  if p.name == "zq-analyze-progress.vue" and 'data-no-analyze-preview="1"' in text:
    continue
  new = scrub(text)
  if new == text:
    continue
  backup_file(p)
  p.write_text(new, encoding="utf-8")
  changed.append(str(p.relative_to(root)))

print(f"preview-scrubbed {len(changed)} files")
for c in changed[:40]:
  print("  ~", c)
PY

echo
echo "==> 3/5 Patch tennis-ai.ipa embedded JS (iOS www); APK zip-inject DISABLED"
# Never zip-rewrite tennis-ai.apk here — that breaks the signing cert and
# makes installs fail. APK must come from a full release rebuild+resign
# (sibling "Build signed release APK" or local gradle+keystore).
# Opt-in only: SKIP_APK_ARCHIVE_PATCH=0 would still refuse APK; use
# ALLOW_APK_ZIP_INJECT=1 only for emergency lab testing (never prod).
python3 - "$ROOT" "$BACKUP" <<'PY'
import io, os, pathlib, shutil, sys, zipfile

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
allow_apk = os.environ.get("ALLOW_APK_ZIP_INJECT", "0") == "1"

DROP = [
  "分析预览",
  "Analysis preview",
  "上传后这里会显示你的录像预览",
  "Your clip preview will show up here after upload",
]

candidates = []
for base in (
  pathlib.Path("/var/www/apk"),
  pathlib.Path("/usr/share/nginx/html"),
  pathlib.Path("/var/www"),
  root / "public",
  root,
):
  if not base.exists():
    continue
  if allow_apk:
    candidates.extend(base.glob("**/tennis-ai.apk"))
  candidates.extend(base.glob("**/tennis-ai.ipa"))

if not allow_apk:
  print("  · skipping tennis-ai.apk zip-inject (preserve install signature)")

seen = set()
patched = []
skipped_apk = []


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
  if archive.suffix.lower() == ".apk" and not allow_apk:
    skipped_apk.append(str(archive))
    continue
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
  print("  ipa:", a)
if skipped_apk:
  print(f"  apk left untouched: {len(skipped_apk)}")
if not patched:
  print("  (no IPA string hits — may already be clean or archives absent)")
PY

echo
echo "==> 4/5 Rebuild Next + refresh mp-weixin.zip"
cd "$ROOT"
if [[ -f package.json ]]; then
  if id tennis &>/dev/null; then
    sudo -u tennis -H bash -lc "cd '$ROOT' && npm run build" || npm run build
  else
    npm run build
  fi
  systemctl restart tennis-ai || true
fi

# Zip mp-weixin when dist present
MP_SRC=""
for d in \
  "$ROOT/apps/uniapp/dist/build/mp-weixin" \
  "$ROOT/apps/uniapp/dist/dev/mp-weixin" \
  "$ROOT/miniprogram"
do
  if [[ -f "$d/app.json" ]]; then
    MP_SRC="$d"
    break
  fi
done
if [[ -n "$MP_SRC" ]]; then
  TMP_ZIP="/tmp/mp-weixin-no-preview-${STAMP}.zip"
  (cd "$MP_SRC" && zip -qr "$TMP_ZIP" .)
  install -D -m 0644 "$TMP_ZIP" "$APK_DIR/mp-weixin.zip"
  echo "  + $APK_DIR/mp-weixin.zip from $MP_SRC"
fi

# chmod published natives
chmod 644 "$APK_DIR"/tennis-ai.apk "$APK_DIR"/tennis-ai.ipa "$APK_DIR"/mp-weixin.zip 2>/dev/null || true

echo
echo "==> 5/5 Public smoke marker"
python3 - "$ROOT/public/remove-analyze-preview.html" <<'PY'
from pathlib import Path
import sys
out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>涨球 · 已去掉分析预览</title>
  <style>
    body{margin:0;font-family:"PingFang SC","Noto Sans SC",sans-serif;
      background:linear-gradient(160deg,#ecfeff,#f8fafc 55%);color:#0f172a;padding:1.5rem}
    .card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #d5e0d9;
      border-radius:16px;padding:1.25rem}
    .kicker{display:inline-block;font-size:11px;font-weight:700;color:#0f3d36;
      background:#ccfbf1;border-radius:999px;padding:2px 8px}
    h1{font-size:1.2rem;margin:.5rem 0}
    p{color:#5b6b62;line-height:1.5}
    code{background:#f1f5f9;padding:.1rem .35rem;border-radius:4px}
  </style>
</head>
<body>
  <div class="card" data-no-analyze-preview="1">
    <span class="kicker">涨球</span>
    <h1>分析等待页已去掉「分析预览」</h1>
    <p>保留五步进度、百分比、当前步骤与 ETA。报告 / 示范 / 教练选择未改。</p>
    <p>Marker: <code>data-no-analyze-preview=1</code></p>
  </div>
</body>
</html>
""", encoding="utf-8")
print("wrote", out)
PY

# Whitelist marker in middleware if present
if [[ -f "$ROOT/middleware.ts" ]]; then
  if ! grep -q 'remove-analyze-preview.html' "$ROOT/middleware.ts"; then
    python3 - "$ROOT/middleware.ts" "$BACKUP" <<'PY'
import pathlib, re, shutil, sys
path = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
text = path.read_text(encoding="utf-8")
if "remove-analyze-preview.html" in text:
  raise SystemExit(0)
bak = backup / "middleware.ts"
bak.parent.mkdir(parents=True, exist_ok=True)
if not bak.exists():
  shutil.copy2(path, bak)
# Common pattern: public file allow lists
repls = [
  # Always use absolute public path so middleware pathname match works.
  (r'(analyze-progress-preview\.html)', r'\1", "/remove-analyze-preview.html'),
  (r'(demo-video-clean-preview\.html)', r'\1", "/remove-analyze-preview.html'),
  (r'(PUBLIC_FILES\s*=\s*\[)', r'\1"/remove-analyze-preview.html", '),
]
new = text
for pat, rep in repls:
  n2 = re.sub(pat, rep, new, count=1)
  if n2 != new:
    new = n2
    break
else:
  # Fallback: append a comment marker so humans can wire
  new = text + "\n// allow: /tennis/remove-analyze-preview.html\n"
if new != text:
  path.write_text(new, encoding="utf-8")
  print("  ~ middleware.ts allowlist touched")
PY
  fi
fi

echo
echo "DONE remove-analyze-preview apply on $ROOT"
ls -la "$APK_DIR"/tennis-ai.apk "$APK_DIR"/tennis-ai.ipa "$APK_DIR"/mp-weixin.zip 2>/dev/null || true
