#!/usr/bin/env bash
# ZQ-135: 我的约球底部「我发出的邀请」
# Code only. Does NOT modify Postgres / auth blobs / match intros rows.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.sent-invites-section-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/app/api/friends/intros"
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/intros/route.ts" "$BACKUP/app/api/friends/intros/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" "$ROOT/app/api/friends/intros"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/intros/route.ts" "$ROOT/app/api/friends/intros/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/SENT-INVITES-SECTION-NOTE.txt" /var/www/apk/SENT-INVITES-SECTION-NOTE.txt
chmod 644 /var/www/apk/SENT-INVITES-SECTION-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/sent-invites-section.html
  chmod 644 /var/www/apk/sent-invites-section.html || true
fi

echo "==> Sanity"
grep -n "sentPending" "$ROOT/lib/match-intros.ts" | head -5
grep -n "sentPending" "$ROOT/app/api/friends/intros/route.ts" | head -5
grep -n "matchSentPendingTitle\|data-match-sent-pending" "$ROOT/components/friends-view.tsx" | head -8
grep -n "matchSentPendingTitle" "$ROOT/lib/i18n/messages.ts" | head -5

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
echo "DONE apply sent-invites-section (no DB writes)"
