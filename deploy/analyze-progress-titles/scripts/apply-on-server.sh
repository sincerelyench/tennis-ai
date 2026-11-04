#!/usr/bin/env bash
# 涨球 · analyze progress titles-only — apply on 8.216.53.29 (/opt/tennis-ai)
# Surfaces: Next web + uni-app component + public preview + mp-weixin.zip refresh.
# Keeps header (正在提交视频… / 正在分析挥拍) + progress bar; strips step blurbs/ETAs.
#
# Usage:
#   bash deploy/analyze-progress-titles/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
UNI="$HERE/uniapp-patch"
PREVIEW="$HERE/preview"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.analyze-progress-titles-backup-${STAMP}"
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
  "$ROOT/apps/uniapp/src/components"

echo "==> 1/3 Drop-in Next + uni-app titles-only progress"
copy_bak "$PATCH/components/analyze-progress.tsx" "$ROOT/components/analyze-progress.tsx"
copy_bak "$PATCH/lib/job-progress.ts" "$ROOT/lib/job-progress.ts"
copy_bak "$PATCH/lib/messages-analyze-progress.snippet.ts" \
  "$ROOT/lib/messages-analyze-progress.snippet.ts"
copy_bak "$UNI/zq-analyze-progress.vue" \
  "$ROOT/apps/uniapp/src/components/zq-analyze-progress.vue"
copy_bak "$PREVIEW/analyze-progress-preview.html" \
  "$ROOT/public/analyze-progress-preview.html"

echo
echo "==> 2/3 Rebuild Next + restart"
cd "$ROOT"
if [[ "$(id -un)" == "root" ]] && id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
else
  npm run build
fi
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true

echo
echo "==> 3/3 Refresh mp-weixin.zip when dist/source present; leave APK signature intact"
MP_SRC=""
for d in \
  "$ROOT/apps/uniapp/dist/build/mp-weixin" \
  "$ROOT/apps/uniapp/dist/dev/mp-weixin" \
  "$ROOT/miniprogram"
do
  if [[ -f "$d/app.json" ]]; then MP_SRC="$d"; break; fi
done
if [[ -n "$MP_SRC" ]]; then
  TMP_ZIP="/tmp/mp-weixin-titles-$$.zip"
  (cd "$MP_SRC" && zip -qr "$TMP_ZIP" .)
  install -m 0644 "$TMP_ZIP" "$APK_DIR/mp-weixin.zip"
  rm -f "$TMP_ZIP"
  echo "  refreshed $APK_DIR/mp-weixin.zip from $MP_SRC"
else
  echo "  · no mp-weixin dist (uni component source updated; WebView shells pick up Next rebuild)"
fi

# Soft-patch IPA embedded www progress component strings only (no APK zip-inject)
if [[ -f "$APK_DIR/tennis-ai.ipa" ]]; then
  python3 - "$APK_DIR/tennis-ai.ipa" "$BACKUP" <<'PY'
import pathlib, sys, zipfile, io, shutil
archive = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
kill = [
  "打开你的录像",
  "看清挥拍动作",
  "标出每一次击球",
  "整理评分依据",
  "涨球教练生成练习建议",
  "短片约 0.2 秒",
  "短片约 1 秒 / 长片数分钟",
  "短片约 0.1 秒",
  "快速路径用规则；完整分析约 2 分钟",
]
try:
  zin = zipfile.ZipFile(archive, "r")
except Exception as e:
  print("  skip ipa:", e)
  raise SystemExit(0)
dirty = False
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
  for info in zin.infolist():
    data = zin.read(info.filename)
    lower = info.filename.lower()
    if lower.endswith((".js", ".html", ".vue")) and any(k.encode() in data for k in kill):
      try:
        text = data.decode("utf-8")
      except Exception:
        zout.writestr(info, data)
        continue
      new = text
      for k in kill:
        new = new.replace(k, "")
      if new != text:
        data = new.encode("utf-8")
        dirty = True
    zout.writestr(info, data)
zin.close()
if dirty:
  bak = backup / "archives" / archive.name
  bak.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(archive, bak)
  archive.write_bytes(buf.getvalue())
  print(f"  patched IPA www step subtitles: {archive}")
else:
  print(f"  IPA unchanged (no step-subtitle hits or WebView-only): {archive.name}")
PY
else
  echo "  · no tennis-ai.ipa at $APK_DIR"
fi

chmod 644 "$APK_DIR"/tennis-ai.apk "$APK_DIR"/tennis-ai.ipa "$APK_DIR"/mp-weixin.zip 2>/dev/null || true
ls -la "$APK_DIR"/tennis-ai.apk "$APK_DIR"/tennis-ai.ipa "$APK_DIR"/mp-weixin.zip 2>/dev/null || true
echo
echo "Done. Preview: https://yqchen.blog/tennis/analyze-progress-preview.html"
echo "Live app: https://yqchen.blog/tennis"
