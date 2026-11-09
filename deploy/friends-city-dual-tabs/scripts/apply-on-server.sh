#!/usr/bin/env bash
# Apply: 约球城市下双 Tab（匹配约球 / 本地排行可挑战）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.friends-city-dual-tabs-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/public"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/friends-city-dual-tabs.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/friends-city-dual-tabs.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/FRIENDS-CITY-DUAL-TABS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/FRIENDS-CITY-DUAL-TABS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

echo "==> Build Next app"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npx next build --webpack || npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true
curl -sf -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43127/tennis || true
echo "DONE apply friends-city-dual-tabs"
