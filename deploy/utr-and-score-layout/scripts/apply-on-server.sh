#!/usr/bin/env bash
# Apply: UTR-style ladder + 约球录分布局（成功/比赛优先，录分默认收起）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.utr-and-score-layout-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/rating-history"

cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/matchmaking.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/notices-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/rating-history/route.ts" "$BACKUP/app/api/friends/rating-history/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/rating-history"

cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/matchmaking.ts" "$ROOT/lib/matchmaking.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/journey-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/notices-view.tsx" "$ROOT/components/notices-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/rating-history/route.ts" "$ROOT/app/api/friends/rating-history/route.ts"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/utr-and-score-layout.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/utr-and-score-layout.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/UTR-AND-SCORE-LAYOUT-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/UTR-AND-SCORE-LAYOUT-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
curl -sf -o /dev/null -w "ladder:%{http_code}\n" "http://127.0.0.1:43127/tennis/api/friends/ladder?format=singles" || true
echo "DONE apply utr-and-score-layout"
