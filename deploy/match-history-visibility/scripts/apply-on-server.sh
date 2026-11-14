#!/usr/bin/env bash
# ZQ-139: profile 战绩可见 — hide public recent history under ladder when 不可见.
# Auth JSON field only (no Postgres column migration). Does NOT rewrite match scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.match-history-visibility-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/auth/profile" "$BACKUP/app/api/auth/session" \
  "$BACKUP/app/api/friends/player-matches"
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/session-role.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/profile/route.ts" "$BACKUP/app/api/auth/profile/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/session/route.ts" "$BACKUP/app/api/auth/session/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/player-matches/route.ts" \
  "$BACKUP/app/api/friends/player-matches/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/auth/profile" "$ROOT/app/api/auth/session" \
  "$ROOT/app/api/friends/player-matches"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/session-role.ts" "$ROOT/lib/session-role.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/session/route.ts" "$ROOT/app/api/auth/session/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/player-matches/route.ts" \
  "$ROOT/app/api/friends/player-matches/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/MATCH-HISTORY-VISIBILITY-NOTE.txt" \
  /var/www/apk/MATCH-HISTORY-VISIBILITY-NOTE.txt
chmod 644 /var/www/apk/MATCH-HISTORY-VISIBILITY-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/match-history-visibility.html
  chmod 644 /var/www/apk/match-history-visibility.html || true
fi

echo "==> Sanity"
grep -n "matchHistoryPublic\|isMatchHistoryPublic" "$ROOT/lib/auth-store.ts" | head -12
grep -n "matchHistoryPublic" "$ROOT/app/api/auth/profile/route.ts" | head -8
grep -n "historyHidden\|isMatchHistoryPublic" \
  "$ROOT/app/api/friends/player-matches/route.ts" | head -12
grep -n "isMatchHistoryPublicForPhone" "$ROOT/lib/match-scores.ts" | head -6
grep -n "matchHistoryVisibility\|data-settings-match-history-visibility" \
  "$ROOT/components/profile-view.tsx" | head -12
grep -n "ladderDetailHistoryHidden\|historyHidden" \
  "$ROOT/components/friends-view.tsx" | head -12
grep -n "matchHistoryVisibility" "$ROOT/lib/i18n/messages.ts" | head -16

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
curl -sf -o /dev/null -w "profile:%{http_code}\n" http://127.0.0.1:43127/tennis/ || true
echo "DONE apply match-history-visibility (no match-score DB writes)"
