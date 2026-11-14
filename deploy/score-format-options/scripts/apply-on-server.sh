#!/usr/bin/env bash
# ZQ-140: score format options — 一盘制(抢7/抢10/自由) + 三盘两胜/五盘三胜
# Code only. JSON fields on match_scores_blob; no Postgres column migration.
# Does NOT rewrite existing scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.score-format-options-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/scores"
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/route.ts" "$BACKUP/app/api/friends/scores/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/scores"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/route.ts" \
  "$ROOT/app/api/friends/scores/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/SCORE-FORMAT-OPTIONS-NOTE.txt" \
  /var/www/apk/SCORE-FORMAT-OPTIONS-NOTE.txt
chmod 644 /var/www/apk/SCORE-FORMAT-OPTIONS-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/score-format-options.html
  chmod 644 /var/www/apk/score-format-options.html || true
fi

echo "==> Sanity"
grep -n "matchLength\|shortFormat\|normalizeMatchLength\|raceTargetForShort" \
  "$ROOT/lib/match-scores.ts" | head -16
grep -n "sets.length >= 5\|抢7\|formatWeight" \
  "$ROOT/lib/local-ladder.ts" | head -12
grep -n "matchLength\|shortFormat\|data-score-match-length\|data-score-short-format" \
  "$ROOT/components/friends-view.tsx" | head -16
grep -n "matchLengthBo3\|shortFormatRace7\|scoreRaceNeed" \
  "$ROOT/lib/i18n/messages.ts" | head -16
grep -n "matchLength\|shortFormat" \
  "$ROOT/app/api/friends/scores/route.ts" | head -12

echo "==> Build Next app (before restart)"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npx next build --webpack || npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
echo "DONE apply score-format-options (no DB writes)"
