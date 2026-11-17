#!/usr/bin/env bash
# ZQ-148: 女单 — profile gender wins over seed-name allowlist
# Surgical apply on top of live 女单 (no invented prod gender rows).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-gender-wins-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" \
  "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/directory" \
  "$BACKUP/app/api/auth/profile" \
  "$BACKUP/app/api/auth/session"
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/player-gender.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/session-role.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/directory/route.ts" "$BACKUP/app/api/friends/directory/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/profile/route.ts" "$BACKUP/app/api/auth/profile/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/session/route.ts" "$BACKUP/app/api/auth/session/" 2>/dev/null || true

echo "==> Install ZQ-148 opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/components" \
  "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/directory" \
  "$ROOT/app/api/auth/profile" \
  "$ROOT/app/api/auth/session"
cp -a "$PATCH_DIR/opt-patch/lib/player-gender.ts" "$ROOT/lib/player-gender.ts"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/session-role.ts" "$ROOT/lib/session-role.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/directory/route.ts" "$ROOT/app/api/friends/directory/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/session/route.ts" "$ROOT/app/api/auth/session/route.ts"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/LADDER-GENDER-WINS-NOTE.txt" /var/www/apk/LADDER-GENDER-WINS-NOTE.txt
chmod 644 /var/www/apk/LADDER-GENDER-WINS-NOTE.txt || true

echo "==> Sanity (male must precede allowlist)"
grep -n "if (g === \"male\") return false" "$ROOT/lib/player-gender.ts"
grep -n "fresh" "$ROOT/app/api/friends/ladder/route.ts" | head -5
grep -n "gender" "$ROOT/app/api/friends/directory/route.ts" | head -10
grep -n "session.gender" "$ROOT/components/friends-view.tsx" | head -5
test -f "$ROOT/lib/player-gender.ts"

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
curl -sf -o /dev/null -w "ladder:%{http_code}\n" http://127.0.0.1:43127/tennis/ladder || true
echo "DONE apply ladder-gender-wins (ZQ-148; no invented gender DB rows)"
