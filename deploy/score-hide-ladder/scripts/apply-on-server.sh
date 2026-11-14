#!/usr/bin/env bash
# ZQ-138: score privacy — 展示/隐藏 for ladder city「比赛结果」
# Code only. Does NOT modify Postgres / match_scores rows.
# New JSON fields on blob payloads only (no column migration).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.score-hide-ladder-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/scores" "$BACKUP/app/api/friends/scores/action"
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/route.ts" "$BACKUP/app/api/friends/scores/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/action/route.ts" "$BACKUP/app/api/friends/scores/action/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/scores" "$ROOT/app/api/friends/scores/action"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/route.ts" "$ROOT/app/api/friends/scores/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/action/route.ts" \
  "$ROOT/app/api/friends/scores/action/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/SCORE-HIDE-LADDER-NOTE.txt" /var/www/apk/SCORE-HIDE-LADDER-NOTE.txt
chmod 644 /var/www/apk/SCORE-HIDE-LADDER-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/score-hide-ladder.html
  chmod 644 /var/www/apk/score-hide-ladder.html || true
fi

echo "==> Sanity"
grep -n "isHiddenFromPublicFeed\|hideFromPublicFeed\|submitterHideFromPublic" \
  "$ROOT/lib/match-scores.ts" | head -12
grep -n "hideFromPublic" "$ROOT/app/api/friends/scores/route.ts" | head -5
grep -n "hideFromPublic" "$ROOT/app/api/friends/scores/action/route.ts" | head -5
grep -n "scorePrivacyShow\|ScorePrivacyToggle\|data-score-privacy" \
  "$ROOT/components/friends-view.tsx" | head -12
grep -n "scorePrivacyShow\|scorePrivacyHide\|scorePrivacyHint" \
  "$ROOT/lib/i18n/messages.ts" | head -12

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
echo "DONE apply score-hide-ladder (no DB writes)"
