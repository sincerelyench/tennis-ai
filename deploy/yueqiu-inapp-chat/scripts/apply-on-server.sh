#!/usr/bin/env bash
# ZQ-141: 约球成功后站内留言 + 通知；微信可选
# Code only. Messages hang on match_intros_blob intro rows (messages / messageUnreadBy).
# No mass deletes. No fake users. Schema: JSON fields only (no new Postgres tables required).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.yueqiu-inapp-chat-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" \
  "$BACKUP/app/api/friends/intros" "$BACKUP/app/api/friends/messages"
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/notices-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/intros/route.ts" "$BACKUP/app/api/friends/intros/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/messages" "$BACKUP/app/api/friends/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/friends/intros" "$ROOT/app/api/friends/messages"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/notices-view.tsx" "$ROOT/components/notices-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/intros/route.ts" "$ROOT/app/api/friends/intros/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/messages/route.ts" "$ROOT/app/api/friends/messages/route.ts"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/YUEQIU-INAPP-CHAT-NOTE.txt" /var/www/apk/YUEQIU-INAPP-CHAT-NOTE.txt
chmod 644 /var/www/apk/YUEQIU-INAPP-CHAT-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/yueqiu-inapp-chat.html
  chmod 644 /var/www/apk/yueqiu-inapp-chat.html || true
fi

echo "==> Sanity"
grep -n "postMessageToIntro\|messageUnreadBy\|listMessageNotifyForUser\|canMessage" \
  "$ROOT/lib/match-intros.ts" | head -20
grep -n "matchChatOpen\|matchSuccessWechatMissing\|notices.messages\|messageNotify" \
  "$ROOT/lib/i18n/messages.ts" | head -20
grep -n "data-match-chat\|openMatchChat\|matchChatOpen" \
  "$ROOT/components/friends-view.tsx" | head -20
grep -n "data-notices-messages\|messageNotify\|messageOpenThread" \
  "$ROOT/components/notices-view.tsx" | head -20
grep -n "messageNotify\|friends/messages" \
  "$ROOT/app/api/friends/intros/route.ts" "$ROOT/app/api/friends/messages/route.ts" | head -20

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
curl -sf -o /dev/null -w "messages-api-options:%{http_code}\n" \
  -X OPTIONS http://127.0.0.1:43127/tennis/api/friends/messages || true
echo "DONE apply yueqiu-inapp-chat (no mass DB deletes; messages on intros blob)"
