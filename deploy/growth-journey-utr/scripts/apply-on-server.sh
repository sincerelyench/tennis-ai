#!/usr/bin/env bash
# Apply: 成长旅程展示 UTR / 等级分成绩变化
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.growth-journey-utr-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/(main)/journey" \
  "$BACKUP/app/api/friends/rating-history" \
  "$BACKUP/public"

cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/journey-curve.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/journey-share-card.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/report-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/journey/page.tsx" "$BACKUP/app/(main)/journey/" 2>/dev/null || true
if [[ -f "$ROOT/app/api/friends/rating-history/route.ts" ]]; then
  cp -a "$ROOT/app/api/friends/rating-history/route.ts" "$BACKUP/app/api/friends/rating-history/" 2>/dev/null || true
fi

echo "==> Install opt-patch"
mkdir -p "$ROOT/app/api/friends/rating-history" "$ROOT/app/(main)/journey" "$ROOT/lib/i18n" "$ROOT/components" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/journey-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/journey-curve.tsx" "$ROOT/components/journey-curve.tsx"
cp -a "$PATCH_DIR/opt-patch/components/journey-share-card.tsx" "$ROOT/components/journey-share-card.tsx"
cp -a "$PATCH_DIR/opt-patch/components/report-view.tsx" "$ROOT/components/report-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/(main)/journey/page.tsx" "$ROOT/app/(main)/journey/page.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/rating-history/route.ts" "$ROOT/app/api/friends/rating-history/route.ts"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/growth-journey-utr.html"
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/growth-journey-utr.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/GROWTH-JOURNEY-UTR-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/GROWTH-JOURNEY-UTR-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
curl -sf -o /dev/null -w "rating-history:%{http_code}\n" http://127.0.0.1:43127/tennis/api/friends/rating-history || true
echo "DONE apply growth-journey-utr"
