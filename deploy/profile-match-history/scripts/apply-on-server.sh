#!/usr/bin/env bash
# Apply: 我的页「约球成绩」Tab（confirmed match history）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.profile-match-history-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/public"

cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true

echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/profile-match-history.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/profile-match-history.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/PROFILE-MATCH-HISTORY-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/PROFILE-MATCH-HISTORY-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
echo "DONE apply profile-match-history"
