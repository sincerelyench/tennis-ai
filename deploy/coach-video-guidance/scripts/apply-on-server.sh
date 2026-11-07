#!/usr/bin/env bash
# Apply coach-tab video guidance onto /opt/tennis-ai
# Does NOT touch lib/feature-flags.ts or app-shell (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-video-guidance-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" "$BACKUP/public"
for f in \
  lib/coach-video-guidance.ts \
  components/coach-video-upload.tsx \
  components/coach-view.tsx
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (coach video guidance)"
mkdir -p "$ROOT/lib" "$ROOT/components" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/lib/coach-video-guidance.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/coach-video-upload.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-video-guidance.html"
fi

# Allow unauthenticated preview page if middleware lists public paths.
if [[ -f "$PATCH_DIR/scripts/patch-middleware.py" && -f "$ROOT/middleware.ts" ]]; then
  python3 "$PATCH_DIR/scripts/patch-middleware.py" "$ROOT" || true
fi

echo "==> Build + restart"
cd "$ROOT"
if command -v npm >/dev/null; then
  if id tennis >/dev/null 2>&1; then
    sudo -u tennis npm run build
  else
    npm run build
  fi
  systemctl restart tennis-ai || true
  sleep 2
  systemctl is-active tennis-ai || true
fi

echo "DONE coach-video-guidance apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/tennis/coach-video-guidance.html"
echo "Backup: $BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
