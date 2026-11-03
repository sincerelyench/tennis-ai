#!/usr/bin/env bash
# Apply video-clip-duration: default/min 10s window, drag longer up to full source.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.video-clip-duration-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/public/assets"

cp -a "$ROOT/lib/clip.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/public/assets" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/lib/clip.ts" "$ROOT/lib/clip.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/video-clip-duration.html"
fi

# Patch any embedded uni www bundles under the tree
if [[ -f "$PATCH_DIR/uniapp-www/assets/index-SaS00-5Q.js" ]]; then
  while IFS= read -r -d '' target; do
    cp -a "$PATCH_DIR/uniapp-www/assets/index-SaS00-5Q.js" "$target"
    echo "  patched uni bundle -> $target"
  done < <(find "$ROOT" -path '*/www/assets/index-SaS00-5Q.js' -print0 2>/dev/null || true)
  cp -a "$PATCH_DIR/uniapp-www/assets/index-SaS00-5Q.js" "$ROOT/public/assets/index-SaS00-5Q.js"
fi

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  sleep 2
  systemctl is-active tennis-ai
fi

# Smoke: default/min rules present
python3 - <<PY
from pathlib import Path
clip = Path("$ROOT/lib/clip.ts").read_text()
assert "CLIP_DEFAULT_SEC = 10" in clip
assert "CLIP_MIN_SEC = 10" in clip
assert "POSITIVE_INFINITY" in clip or "Infinity" in clip
assert "length > CLIP_MAX_SEC" not in clip
msg = Path("$ROOT/lib/i18n/messages.ts").read_text()
assert "可拖长，但不能短于 10 秒" in msg
assert "drag to extend (minimum 10 seconds)" in msg
print("server selfcheck ok")
PY

echo "DONE apply video-clip-duration"
