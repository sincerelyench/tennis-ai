#!/usr/bin/env bash
# Journey: remove「投影」/(P) label from /journey summary + match rows.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.journey-remove-projection-backup-$STAMP"
LOCK="/tmp/tennis-ai-deploy.lock"

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "ABORT: another deploy holds $LOCK" >&2
  ls -la "$LOCK" >&2 || true
  exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

if pgrep -af 'next build' | grep -v "$$" >/dev/null 2>&1; then
  echo "ABORT: next build already running" >&2
  pgrep -af 'next build' >&2 || true
  exit 1
fi

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components"
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/"

echo "==> Install opt-patch (journey-view only)"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p /var/www/apk "$ROOT/public"
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/journey-remove-projection.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/journey-remove-projection.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/JOURNEY-REMOVE-PROJECTION-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/JOURNEY-REMOVE-PROJECTION-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

chown tennis:tennis "$ROOT/components/journey-view.tsx" 2>/dev/null || true
cd "$ROOT"
sudo -u tennis -H bash -lc 'npx next build --webpack'
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai
echo "Done. backup=$BACKUP"
