#!/usr/bin/env bash
# ZQ-147 / ZQ-148: 排行榜「双打」→「女单」；资料性别权威，种子名仅未填时兜底
# Code + optional self-report gender field. No invented prod gender rows.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-womens-singles-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/directory" \
  "$BACKUP/app/api/auth/profile" \
  "$BACKUP/app/api/auth/session"
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/session-role.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/player-gender.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/directory/route.ts" "$BACKUP/app/api/friends/directory/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/profile/route.ts" "$BACKUP/app/api/auth/profile/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/session/route.ts" "$BACKUP/app/api/auth/session/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/directory" \
  "$ROOT/app/api/auth/profile" \
  "$ROOT/app/api/auth/session"
cp -a "$PATCH_DIR/opt-patch/lib/player-gender.ts" "$ROOT/lib/player-gender.ts"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/session-role.ts" "$ROOT/lib/session-role.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/directory/route.ts" "$ROOT/app/api/friends/directory/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/session/route.ts" "$ROOT/app/api/auth/session/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/LADDER-WOMENS-SINGLES-NOTE.txt" /var/www/apk/LADDER-WOMENS-SINGLES-NOTE.txt
chmod 644 /var/www/apk/LADDER-WOMENS-SINGLES-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/ladder-womens-singles.html
  chmod 644 /var/www/apk/ladder-womens-singles.html || true
fi

echo "==> Ensure nginx preview aliases"
CONF=/etc/nginx/conf.d/ipitch.conf
if [[ -f "$CONF" ]] && ! grep -q "ladder-womens-singles.html" "$CONF"; then
  cp -a "$CONF" "$CONF.bak.ladder-womens-singles-$(date +%Y%m%d-%H%M%S)"
  cat >> "$CONF" <<'NGX'

    location = /ladder-womens-singles.html {
        alias /var/www/apk/ladder-womens-singles.html;
        add_header Cache-Control "no-store";
        default_type text/html;
    }
    location = /LADDER-WOMENS-SINGLES-NOTE.txt {
        alias /var/www/apk/LADDER-WOMENS-SINGLES-NOTE.txt;
        add_header Cache-Control "no-store";
        default_type text/plain;
    }
NGX
  nginx -t && systemctl reload nginx || true
fi

echo "==> Sanity"
grep -n "womens_singles\|女单\|womensSingles" "$ROOT/components/friends-view.tsx" | head -20
grep -n "womens_singles\|isFemalePlayer\|ratingFormatOf" "$ROOT/lib/local-ladder.ts" | head -20
grep -n "gender\|PlayerGender\|fresh" "$ROOT/lib/auth-store.ts" | head -30
grep -n "womensSingles\|女单" "$ROOT/lib/i18n/messages.ts" | head -20
grep -n "gender\|fresh" "$ROOT/app/api/friends/directory/route.ts" | head -20
grep -n "if (g === \"male\")" "$ROOT/lib/player-gender.ts"
! grep -q 'FORMATS: LadderFormat\[] = \["singles", "doubles"\]' "$ROOT/components/friends-view.tsx"
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
echo "DONE apply ladder-womens-singles (no invented gender DB rows)"
