#!/usr/bin/env bash
# Apply: 约球双 Tab「我的约球 / 本地排行」+ 两边匹配约球 + 精简文案（ZQ-75）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.yueqiu-my-and-ladder-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/yueqiu-my-and-ladder.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/yueqiu-my-and-ladder.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/YUEQIU-MY-AND-LADDER-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/YUEQIU-MY-AND-LADDER-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
echo "DONE apply yueqiu-my-and-ladder"
