#!/usr/bin/env bash
# ZQ-143: 排行榜独立为底栏第二 Tab；约球去掉本地排行子 Tab
# Code only. No DB writes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-bottom-tab-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/(main)/friends" "$BACKUP/app/(main)/ladder"
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/lib/coach-home.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/feature-flags.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/friends/page.tsx" "$BACKUP/app/(main)/friends/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/ladder" "$BACKUP/app/(main)/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/(main)/friends" "$ROOT/app/(main)/ladder"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/lib/coach-home.ts" "$ROOT/lib/coach-home.ts"
cp -a "$PATCH_DIR/opt-patch/lib/feature-flags.ts" "$ROOT/lib/feature-flags.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"
cp -a "$PATCH_DIR/opt-patch/app/(main)/friends/page.tsx" "$ROOT/app/(main)/friends/page.tsx"
cp -a "$PATCH_DIR/opt-patch/app/(main)/ladder/page.tsx" "$ROOT/app/(main)/ladder/page.tsx"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/LADDER-BOTTOM-TAB-NOTE.txt" /var/www/apk/LADDER-BOTTOM-TAB-NOTE.txt
chmod 644 /var/www/apk/LADDER-BOTTOM-TAB-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/ladder-bottom-tab.html
  chmod 644 /var/www/apk/ladder-bottom-tab.html || true
fi


echo "==> Ensure nginx preview aliases"
CONF=/etc/nginx/conf.d/ipitch.conf
if [[ -f "$CONF" ]] && ! grep -q "ladder-bottom-tab.html" "$CONF"; then
  cp -a "$CONF" "$CONF.bak.ladder-bottom-tab-$(date +%Y%m%d-%H%M%S)"
  cat >> "$CONF" <<'NGX'

    location = /ladder-bottom-tab.html {
        alias /var/www/apk/ladder-bottom-tab.html;
        add_header Cache-Control "no-store";
        default_type text/html;
    }
    location = /LADDER-BOTTOM-TAB-NOTE.txt {
        alias /var/www/apk/LADDER-BOTTOM-TAB-NOTE.txt;
        add_header Cache-Control "no-store";
        default_type text/plain;
    }
NGX
  nginx -t && systemctl reload nginx || true
fi

echo "==> Sanity"
grep -n "nav.ladder\|/ladder\|grid-cols-5" "$ROOT/components/app-shell.tsx" | head -20
grep -n "ladderPageTitle\|ladder: \"排行榜\"\|ladder: \"Ladder\"" "$ROOT/lib/i18n/messages.ts" | head -20
grep -n "surface\|data-friends-surface\|data-friends-main-tabs\|ladder-results\"" \
  "$ROOT/components/friends-view.tsx" | head -30
test ! -f /dev/null
! grep -q 'data-friends-main-tabs' "$ROOT/components/friends-view.tsx"
! grep -q 'data-friends-city-dual-tabs' "$ROOT/components/friends-view.tsx"
grep -n "surface=\"ladder\"\|排行榜" "$ROOT/app/(main)/ladder/page.tsx" | head -10

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
curl -sf -o /dev/null -w "ladder:%{http_code}\n" http://127.0.0.1:43127/tennis/ladder || true
echo "DONE apply ladder-bottom-tab (no DB writes)"
