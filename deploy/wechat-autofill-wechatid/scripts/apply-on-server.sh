#!/usr/bin/env bash
# ZQ-153: WeChat login fills wechatId (openid-derived) + displayName from nickName.
# Builds on ZQ-149/151 kit. Surgical apply — no AppSecret invent, no user deletes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.wechat-autofill-wechatid-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/app/api/auth/wechat"
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/wechat/route.ts" "$BACKUP/app/api/auth/wechat/" 2>/dev/null || true

echo "==> Install ZQ-153 wechat-autofill opt-patch (wechatId + displayName)"
mkdir -p "$ROOT/lib" "$ROOT/app/api/auth/wechat"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat/route.ts" "$ROOT/app/api/auth/wechat/route.ts"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/WECHAT-AUTOFILL-WECHATID-NOTE.txt" /var/www/apk/WECHAT-AUTOFILL-WECHATID-NOTE.txt
chmod 644 /var/www/apk/WECHAT-AUTOFILL-WECHATID-NOTE.txt || true

echo "==> Sanity"
grep -n "wechatIdFromOpenid" "$ROOT/lib/auth-store.ts" | head -5
grep -n "wechatContactSatisfied" "$ROOT/lib/auth-store.ts" | head -5
grep -n "isBlankOrPlaceholderDisplayName" "$ROOT/lib/auth-store.ts" | head -5
grep -n "wechatId: result.wechatId" "$ROOT/app/api/auth/wechat/route.ts" | head -5
grep -n 'client' "$ROOT/app/api/auth/wechat/route.ts" | head -5
grep -n "ZQ-153" "$ROOT/lib/auth-store.ts" | head -5
test -f "$ROOT/lib/auth-store.ts"
test -f "$ROOT/app/api/auth/wechat/route.ts"

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
curl -sf -o /dev/null -w "session:%{http_code}\n" http://127.0.0.1:43127/tennis/api/auth/session || true
echo "DONE apply wechat-autofill-wechatid (ZQ-153; wechatId + displayName←nickName)"
