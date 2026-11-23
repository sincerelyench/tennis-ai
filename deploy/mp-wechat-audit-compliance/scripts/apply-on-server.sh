#!/usr/bin/env bash
# ZQ-168: WeChat 审核 — browse-first, legal consent, AI-generated labels.
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${ZIP:-/var/www/apk/mp-weixin.zip}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_APP="$ROOT/.mp-wechat-audit-backup-$STAMP"
BACKUP_ZIP="/var/www/apk/.mp-weixin-backup-zq168-$STAMP.zip"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Backup app -> $BACKUP_APP"
mkdir -p "$BACKUP_APP/components" "$BACKUP_APP/app/guest" "$BACKUP_APP/app/privacy" "$BACKUP_APP/app/terms"
cp -a "$ROOT/middleware.ts" "$BACKUP_APP/" 2>/dev/null || true
cp -a "$ROOT/components/coach-view.tsx" "$BACKUP_APP/components/" 2>/dev/null || true
cp -a "$ROOT/components/login-view.tsx" "$BACKUP_APP/components/" 2>/dev/null || true

echo "==> Patch H5 (guest/legal/middleware/coach AI notice + password-only login)"
cp -a "$PATCH_DIR/opt-patch/middleware.ts" "$ROOT/middleware.ts"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/coach-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/login-view.tsx" "$ROOT/components/login-view.tsx"
mkdir -p "$ROOT/app/guest" "$ROOT/app/privacy" "$ROOT/app/terms"
cp -a "$PATCH_DIR/opt-patch/app/guest/page.tsx" "$ROOT/app/guest/page.tsx"
cp -a "$PATCH_DIR/opt-patch/app/privacy/page.tsx" "$ROOT/app/privacy/page.tsx"
cp -a "$PATCH_DIR/opt-patch/app/terms/page.tsx" "$ROOT/app/terms/page.tsx"

grep -q 'ZQ-168' "$ROOT/middleware.ts"
grep -q 'data-ai-generated-notice' "$ROOT/components/coach-view.tsx"
grep -q 'data-guest-browse' "$ROOT/app/guest/page.tsx"
grep -q 'data-signin-no-phone' "$ROOT/components/login-view.tsx"
grep -q 'password-only' "$ROOT/components/login-view.tsx"
if grep -q 'modePhone\|function sendCode' "$ROOT/components/login-view.tsx"; then
  echo "ERROR: login-view still contains phone SMS UI" >&2
  exit 1
fi
echo "H5_LOGIN_PASSWORD_ONLY_OK"

echo "==> Rebuild Next"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npm run build
  systemctl start tennis-ai
fi
echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"

echo "==> Patch mp-weixin.zip"
if [[ ! -f "$ZIP" ]]; then
  echo "WARN: missing $ZIP — skip MP zip" >&2
  exit 0
fi
cp -a "$ZIP" "$BACKUP_ZIP"
unzip -qo "$ZIP" -d "$WORKDIR"
MP_ROOT=""
if [[ -d "$WORKDIR/mp-weixin" ]]; then MP_ROOT="$WORKDIR/mp-weixin"
elif [[ -d "$WORKDIR/pages" ]]; then MP_ROOT="$WORKDIR"
else echo "ERROR: mp root not found" >&2; exit 1
fi

mkdir -p "$MP_ROOT/pages/home" "$MP_ROOT/pages/legal"
cp -a "$PATCH_DIR/mp-patch/app.json" "$MP_ROOT/app.json"
cp -a "$PATCH_DIR/mp-patch/pages/home/." "$MP_ROOT/pages/home/"
cp -a "$PATCH_DIR/mp-patch/pages/legal/." "$MP_ROOT/pages/legal/"
cp -a "$PATCH_DIR/mp-patch/pages/login/login.js" "$MP_ROOT/pages/login/login.js"
cp -a "$PATCH_DIR/mp-patch/pages/login/login.wxml" "$MP_ROOT/pages/login/login.wxml"
cp -a "$PATCH_DIR/mp-patch/pages/login/login.wxss" "$MP_ROOT/pages/login/login.wxss"
cp -a "$PATCH_DIR/mp-patch/utils/api.js" "$MP_ROOT/utils/api.js" 2>/dev/null || true
cp -a "$PATCH_DIR/mp-patch/pages/web/web.js" "$MP_ROOT/pages/web/web.js"
cp -a "$PATCH_DIR/mp-patch/WECHAT-AUDIT-NOTE.txt" "$MP_ROOT/WECHAT-AUDIT-NOTE.txt" 2>/dev/null || true

# sanity
python3 - <<PY
from pathlib import Path
import json
root = Path("$MP_ROOT")
app = json.loads((root/"app.json").read_text())
assert app["pages"][0] == "pages/home/home", app["pages"][0]
assert "pages/legal/legal" in app["pages"]
login = (root/"pages/login/login.js").read_text()
assert "agreedLegal" in login and "requireConsent" in login
assert "onWechatLogin" not in login
assert "onPhoneLogin" not in login and "sendPhoneCode" not in login
assert "onRegister" in login and 'role: "player"' in login
wxml = (root/"pages/login/login.wxml").read_text()
assert "data-legal-consent" in wxml
assert 'data-mp-phone-login="off"' in wxml or 'data-auth-tab' in wxml
assert "微信登录" not in wxml
assert "手机验证码" not in wxml
assert "data-auth-tab" in wxml
assert "onPasswordLogin" in login
home = (root/"pages/home/home.wxml").read_text()
assert "data-mp-browse-first" in home
assert "AI生成" in home
web = (root/"pages/web/web.js").read_text()
assert "guest" in web
print("MP_SANITY_OK")
PY

(
  cd "$WORKDIR"
  if [[ -d mp-weixin ]]; then rm -f "$ZIP"; zip -qr "$ZIP" mp-weixin
  else rm -f "$ZIP"; zip -qr "$ZIP" .
  fi
)
chmod 644 "$ZIP"
ls -la "$ZIP" "$BACKUP_ZIP"
echo "DONE ZQ-168 mp-wechat-audit-compliance"

# Prefer syncing DevTools project mirror when kit is co-located
SYNC_KIT="$(cd "$(dirname "$0")/../../mp-local-devtools-sync" 2>/dev/null && pwd || true)"
if [[ -n "${SYNC_KIT:-}" && -x "$SYNC_KIT/scripts/sync-to-local-devtools.sh" ]]; then
  # Refresh mirror from just-built zip
  TMP=$(mktemp -d)
  unzip -qo "$ZIP" -d "$TMP"
  rm -rf "$SYNC_KIT/project"
  if [[ -d "$TMP/mp-weixin" ]]; then cp -a "$TMP/mp-weixin" "$SYNC_KIT/project"
  else mkdir -p "$SYNC_KIT/project"; cp -a "$TMP"/. "$SYNC_KIT/project"/; fi
  rm -rf "$TMP"
  bash "$SYNC_KIT/scripts/sync-to-local-devtools.sh" || echo "NOTE: local DevTools path not on this host — pull branch and sync on Mac"
fi
