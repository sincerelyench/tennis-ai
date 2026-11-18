#!/usr/bin/env bash
# ZQ-150: WeChat 订阅消息 — opt-patch + friends/coach surgical inject
# Run on prod: bash apply-on-server.sh /opt/tennis-ai
# Mac apply is arranged separately (Keychain voice-diary-prod-ssh).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.wechat-subscribe-notify-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" \
  "$BACKUP/app/api/auth/wechat-subscribe" \
  "$BACKUP/app/api/coach/messages"
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/wechat-subscribe.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/wechat-subscribe-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/mp-subscribe-client.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/network-coach-messages.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/network-coach-board.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/notices-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/coach-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/wechat-subscribe" "$BACKUP/app/api/auth/" 2>/dev/null || true
cp -a "$ROOT/app/api/coach/messages" "$BACKUP/app/api/coach/" 2>/dev/null || true

echo "==> Install ZQ-150 opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/components" \
  "$ROOT/app/api/auth/wechat-subscribe" \
  "$ROOT/app/api/coach/messages"
cp -a "$PATCH_DIR/opt-patch/lib/wechat-subscribe.ts" "$ROOT/lib/wechat-subscribe.ts"
cp -a "$PATCH_DIR/opt-patch/lib/wechat-subscribe-store.ts" "$ROOT/lib/wechat-subscribe-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/mp-subscribe-client.ts" "$ROOT/lib/mp-subscribe-client.ts"
cp -a "$PATCH_DIR/opt-patch/lib/network-coach-messages.ts" "$ROOT/lib/network-coach-messages.ts"
cp -a "$PATCH_DIR/opt-patch/lib/network-coach-board.ts" "$ROOT/lib/network-coach-board.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/components/notices-view.tsx" "$ROOT/components/notices-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat-subscribe/route.ts" \
  "$ROOT/app/api/auth/wechat-subscribe/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/messages/route.ts" \
  "$ROOT/app/api/coach/messages/route.ts"

echo "==> Surgical inject friends-view (keep live gender/ladder UI)"
python3 "$PATCH_DIR/scripts/inject-friends-subscribe.py" "$ROOT/components/friends-view.tsx"

echo "==> Surgical inject coach-view hydrate from server board"
python3 "$PATCH_DIR/scripts/inject-coach-board-hydrate.py" "$ROOT/components/coach-view.tsx"

echo "==> Env placeholders (invite ID known; other 4 wait on Yanqing)"
DROPIN_DIR="/etc/systemd/system/tennis-ai.service.d"
mkdir -p "$DROPIN_DIR"
EXAMPLE="$PATCH_DIR/wechat-subscribe-tmpl.env.example"
if [[ -f "$EXAMPLE" ]]; then
  cp -a "$EXAMPLE" "$DROPIN_DIR/wechat-subscribe-tmpl.env.example"
  echo "    wrote $DROPIN_DIR/wechat-subscribe-tmpl.env.example"
  echo "    See WECHAT-CONSOLE-TEMPLATES.md — set WECHAT_MP_TMPL_INVITE + remaining 4"
fi

echo "==> Four-surface note"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/WECHAT-SUBSCRIBE-NOTE.txt" /var/www/apk/WECHAT-SUBSCRIBE-NOTE.txt
chmod 644 /var/www/apk/WECHAT-SUBSCRIBE-NOTE.txt || true
if [[ -f "$PATCH_DIR/mp-weixin.zip" ]]; then
  cp -a "$PATCH_DIR/mp-weixin.zip" /var/www/apk/mp-weixin.zip
  cp -a "$PATCH_DIR/mp-weixin-README.txt" /var/www/apk/mp-weixin-README.txt 2>/dev/null || true
  chmod 644 /var/www/apk/mp-weixin.zip || true
  echo "    updated /var/www/apk/mp-weixin.zip"
fi

echo "==> Sanity"
grep -n "thing13\|notifySubscribe" "$ROOT/lib/wechat-subscribe.ts" | head -8
grep -n "notifySubscribe" "$ROOT/lib/match-intros.ts" | head -5
grep -n "notifySubscribe" "$ROOT/lib/network-coach-messages.ts" | head -5
grep -n "persistToServer\|hydrateNetworkBoardFromServer" "$ROOT/lib/network-coach-board.ts" | head -8
grep -n "hydrateNetworkBoardFromServer\|ZQ-150 coach" "$ROOT/components/coach-view.tsx" | head -8
test -f "$ROOT/lib/wechat-subscribe.ts"
test -f "$ROOT/app/api/auth/wechat-subscribe/route.ts"
test -f "$ROOT/app/api/coach/messages/route.ts"
test -f "$ROOT/lib/network-coach-messages.ts"

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
curl -sf -o /dev/null -w "wechat-subscribe:%{http_code}\n" \
  http://127.0.0.1:43127/tennis/api/auth/wechat-subscribe || true
curl -sf -o /dev/null -w "coach-messages:%{http_code}\n" \
  http://127.0.0.1:43127/tennis/api/coach/messages || true
echo "DONE apply wechat-subscribe-notify (ZQ-150)"
echo "Templates doc: deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md"
echo "Invite TMPL ready; waiting on LADDER / INVITE_ACCEPTED / SCORE_CONFIRM / MESSAGE IDs"
echo "Credits: \$TENNIS_DATA_DIR/wechat-subscribe.json ; coach msgs: network-coach-messages.json"
