#!/usr/bin/env bash
# ZQ-166: temporarily hide WeChat login on mini-program; refresh public zip.
set -euo pipefail
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${ZIP:-/var/www/apk/mp-weixin.zip}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/var/www/apk/.mp-weixin-backup-zq166-$STAMP.zip"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -f "$ZIP" ]]; then
  echo "ERROR: missing $ZIP" >&2
  exit 1
fi

echo "==> Backup $ZIP -> $BACKUP"
cp -a "$ZIP" "$BACKUP"

echo "==> Unpack"
unzip -qo "$ZIP" -d "$WORKDIR"
MP_ROOT=""
if [[ -d "$WORKDIR/mp-weixin/pages/login" ]]; then
  MP_ROOT="$WORKDIR/mp-weixin"
elif [[ -d "$WORKDIR/pages/login" ]]; then
  MP_ROOT="$WORKDIR"
else
  echo "ERROR: cannot find pages/login in zip" >&2
  find "$WORKDIR" -maxdepth 3 -type d | head -40 >&2
  exit 1
fi

echo "==> Patch pages/login from kit (MP_ROOT=$MP_ROOT)"
cp -a "$PATCH_DIR/mp-patch/pages/login/login.js" "$MP_ROOT/pages/login/login.js"
cp -a "$PATCH_DIR/mp-patch/pages/login/login.wxml" "$MP_ROOT/pages/login/login.wxml"
cp -a "$PATCH_DIR/mp-patch/MP-HIDE-WECHAT-LOGIN-NOTE.txt" "$MP_ROOT/MP-HIDE-WECHAT-LOGIN-NOTE.txt"

grep -q 'ZQ-166' "$MP_ROOT/pages/login/login.js" || {
  echo "ERROR: ZQ-166 marker missing in login.js" >&2
  exit 1
}
grep -q 'enableWechatLogin: false' "$MP_ROOT/pages/login/login.js" || {
  echo "ERROR: enableWechatLogin not false" >&2
  exit 1
}
grep -q 'data-mp-wechat-login' "$MP_ROOT/pages/login/login.wxml" || {
  echo "ERROR: data-mp-wechat-login missing in wxml" >&2
  exit 1
}

echo "==> Repack $ZIP"
(
  cd "$WORKDIR"
  if [[ -d mp-weixin ]]; then
    rm -f "$ZIP"
    zip -qr "$ZIP" mp-weixin
  else
    rm -f "$ZIP"
    zip -qr "$ZIP" .
  fi
)
chmod 644 "$ZIP"

echo "==> Sanity"
unzip -p "$ZIP" mp-weixin/pages/login/login.js 2>/dev/null | grep -n 'enableWechatLogin\|ZQ-166' | head -10 \
  || unzip -p "$ZIP" pages/login/login.js | grep -n 'enableWechatLogin\|ZQ-166' | head -10
ls -la "$ZIP" "$BACKUP"
echo "DONE ZQ-166 mp-hide-wechat-login"
