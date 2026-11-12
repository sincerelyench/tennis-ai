#!/usr/bin/env bash
# ZQ-105: rating 6.5 + growth journey harden. Avoid overlapping builds.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.rating-growth-fix-backup-$STAMP"

if pgrep -f 'next build|pnpm build' >/dev/null 2>&1; then
  echo "ABORT: another next/pnpm build is running"
  exit 1
fi

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/rating-history" \
  "$BACKUP/app/(main)"
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/rating-history/route.ts" "$BACKUP/app/api/friends/rating-history/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/error.tsx" "$BACKUP/app/(main)/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> DB fix (keepers + 陈燕青 level 3)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
sudo -u tennis -E env TENNIS_DATABASE_URL="${TENNIS_DATABASE_URL:-}" TENNIS_ROOT="$ROOT" \
  node "$PATCH_DIR/scripts/fix-db.cjs"

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" \
  "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/rating-history" \
  "$ROOT/app/(main)" \
  "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/rating-history/route.ts" "$ROOT/app/api/friends/rating-history/route.ts"

if [[ -f "$PATCH_DIR/mp-patch/RATING-GROWTH-FIX-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/RATING-GROWTH-FIX-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

echo "==> Build Next app (single build)"
cd "$ROOT"
sudo -u tennis -H bash -lc 'cd /opt/tennis-ai && NODE_OPTIONS=--max-old-space-size=3072 npx next build --webpack'

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:43127/tennis/login || true
echo "DONE rating-growth-fix"
