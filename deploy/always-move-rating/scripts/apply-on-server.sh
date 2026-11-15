#!/usr/bin/env bash
# Apply always-move rating: MIN_VISIBLE_DELTA 0.1 + stronger soft exclude.
# Code-only. Does NOT modify Postgres / match scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.always-move-rating-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components"
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true
# Do NOT overwrite friends-view.tsx — ZQ-143 ladder bottom tab owns that file.

echo "==> Install opt-patch (rating logic only; skip friends-view)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/journey-view.tsx"

mkdir -p /var/www/apk
cat > /var/www/apk/ALWAYS-MOVE-RATING-NOTE.txt <<EOF
Always-move rating (ZQ-144 / ZQ-136 follow-up)
Applied: $STAMP
- MIN_VISIBLE_DELTA=0.1: flat winner +0.1 / flat loser -0.1 after each counted match
- SOFT_EXCLUDE_BOOST=0.1, WEIGHT=0.5; soft path also moves loser
- Win floor kept; no DB writes
Web: /opt/tennis-ai. APK/IPA/mp WebView → live /tennis
EOF
chmod 644 /var/www/apk/ALWAYS-MOVE-RATING-NOTE.txt || true

echo "==> Sanity"
grep -n "MIN_VISIBLE_DELTA = 0.1" "$ROOT/lib/local-ladder.ts"
grep -n "SOFT_EXCLUDE_BOOST = 0.1" "$ROOT/lib/local-ladder.ts"
grep -n "SOFT_EXCLUDE_WEIGHT = 0.5" "$ROOT/lib/local-ladder.ts"
grep -n "ensureVisibleMatchMove" "$ROOT/lib/local-ladder.ts" | head -5

echo "==> Build"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npx next build --webpack || npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart"
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
echo "DONE always-move-rating (no DB writes)"
