#!/usr/bin/env bash
# Apply 涨球教练八项技术分步带练 onto /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-eight-techniques-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" "$BACKUP/app/api/coach/chat"
for f in \
  lib/coach.ts \
  lib/coach-roster.ts \
  lib/network-coach-persona.ts \
  lib/eight-techniques.ts \
  components/coach-view.tsx \
  app/api/coach/chat/route.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/components" "$ROOT/app/api/coach/chat" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/lib/eight-techniques.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/coach.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/coach-roster.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/network-coach-persona.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/route.ts"

echo "==> Seed built-in 涨球教练 stroke library prompts from eight-technique canon"
python3 "$PATCH_DIR/scripts/seed-eight-techniques-library.py" "$ROOT"

echo "==> Preview page"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-eight-techniques.html"
python3 "$PATCH_DIR/scripts/patch-middleware.py"

echo "==> Build + restart"
cd "$ROOT"
if command -v npm >/dev/null; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai || true
fi

echo "DONE coach-eight-techniques apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/tennis/coach-eight-techniques.html"
