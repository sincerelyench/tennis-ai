#!/usr/bin/env bash
# ZQ-157: WeChat login leaves wechatId empty (never openid); displayName from nickName.
# Clears openid-derived pollution lazily. Surgical apply — no AppSecret invent, no user deletes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.wechat-autofill-wechatid-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/app/api/auth/wechat"
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/wechat/route.ts" "$BACKUP/app/api/auth/wechat/" 2>/dev/null || true

echo "==> Install ZQ-157 wechatId-not-openid opt-patch (empty wechatId + displayName←nick)"
mkdir -p "$ROOT/lib" "$ROOT/app/api/auth/wechat"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat/route.ts" "$ROOT/app/api/auth/wechat/route.ts"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/WECHAT-AUTOFILL-WECHATID-NOTE.txt" /var/www/apk/WECHAT-AUTOFILL-WECHATID-NOTE.txt
chmod 644 /var/www/apk/WECHAT-AUTOFILL-WECHATID-NOTE.txt || true

echo "==> Sanity"
grep -n "effectiveWechatId" "$ROOT/lib/auth-store.ts" | head -5
grep -n "isOpenidDerivedWechatId" "$ROOT/lib/auth-store.ts" | head -5
grep -n "wechatContactSatisfied" "$ROOT/lib/auth-store.ts" | head -5
grep -n "isBlankOrPlaceholderDisplayName" "$ROOT/lib/auth-store.ts" | head -5
grep -n "ZQ-157" "$ROOT/lib/auth-store.ts" | head -5
grep -n "wechatId: result.wechatId" "$ROOT/app/api/auth/wechat/route.ts" | head -5
# Must NOT autofill wechatId from openid on login anymore.
if grep -n "auto-fill 微信号" "$ROOT/lib/auth-store.ts"; then
  echo "FAIL: openid autofill comment still present" >&2
  exit 1
fi
if grep -n "Lazy backfill" "$ROOT/lib/auth-store.ts"; then
  echo "FAIL: lazy openid backfill still present" >&2
  exit 1
fi
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
echo "DONE apply wechat-autofill-wechatid (ZQ-157; wechatId empty≠openid; displayName←nickName)"
