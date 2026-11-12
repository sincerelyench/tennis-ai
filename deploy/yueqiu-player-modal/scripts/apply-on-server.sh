#!/usr/bin/env bash
# Apply: 本地排行点用户名弹窗看战绩（ZQ-78）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.yueqiu-player-modal-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/player-matches"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/player-matches/route.ts" "$BACKUP/app/api/friends/player-matches/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/player-matches"

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/player-matches/route.ts" "$ROOT/app/api/friends/player-matches/route.ts"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/yueqiu-player-modal.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/yueqiu-player-modal.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/YUEQIU-PLAYER-MODAL-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/YUEQIU-PLAYER-MODAL-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
curl -sf -o /dev/null -w "player-matches:%{http_code}\n" "http://127.0.0.1:43127/tennis/api/friends/player-matches?playerId=x" || true
echo "DONE apply yueqiu-player-modal"
