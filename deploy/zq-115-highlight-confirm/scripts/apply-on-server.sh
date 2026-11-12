#!/usr/bin/env bash
# Apply ZQ-115: highlight+description confirm with score; ladder modal media/comments
# Code only. No wipe scripts. Normal product data writes only via app APIs.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.zq-115-highlight-confirm-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components" \
  "$BACKUP/app/api/friends/scores" \
  "$BACKUP/app/api/friends/player-matches"

cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/route.ts" "$BACKUP/app/api/friends/scores/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/player-matches/route.ts" "$BACKUP/app/api/friends/player-matches/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/[id]" "$BACKUP/app/api/friends/scores/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/components" \
  "$ROOT/app/api/friends/scores" \
  "$ROOT/app/api/friends/player-matches" \
  "$ROOT/app/api/friends/scores/[id]/highlight" \
  "$ROOT/app/api/friends/scores/[id]/comments" \
  "$ROOT/public/match-highlights"

cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/route.ts" "$ROOT/app/api/friends/scores/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/player-matches/route.ts" "$ROOT/app/api/friends/player-matches/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/[id]/highlight/route.ts" \
  "$ROOT/app/api/friends/scores/[id]/highlight/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/[id]/comments/route.ts" \
  "$ROOT/app/api/friends/scores/[id]/comments/route.ts"

chown -R tennis:tennis "$ROOT/public/match-highlights" 2>/dev/null || true
chmod 755 "$ROOT/public/match-highlights" 2>/dev/null || true

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
curl -sf -o /dev/null -w "highlight_options:%{http_code}\n" \
  -X OPTIONS http://127.0.0.1:43127/tennis/api/friends/scores/ms-demo/highlight || true
curl -sf -o /dev/null -w "comments_options:%{http_code}\n" \
  -X OPTIONS http://127.0.0.1:43127/tennis/api/friends/scores/ms-demo/comments || true
echo "DONE apply zq-115-highlight-confirm"
