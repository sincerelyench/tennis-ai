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

grep -q 'ZQ-166b' "$MP_ROOT/pages/login/login.js" || {
  echo "ERROR: ZQ-166b marker missing in login.js" >&2
  exit 1
}
grep -q 'onWechatLogin' "$MP_ROOT/pages/login/login.js" && {
  echo "ERROR: onWechatLogin still present" >&2
  exit 1
}
grep -q 'data-mp-wechat-login="off"' "$MP_ROOT/pages/login/login.wxml" || {
  echo "ERROR: data-mp-wechat-login=off missing in wxml" >&2
  exit 1
}
# Chip text must not appear as a live mode option (comments OK).
if grep -E 'data-mode="wechat"|bindtap="onWechatLogin"' "$MP_ROOT/pages/login/login.wxml"; then
  echo "ERROR: wechat mode still in wxml" >&2
  exit 1
fi

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
unzip -p "$ZIP" mp-weixin/pages/login/login.js 2>/dev/null | grep -n 'ZQ-166b\|mode: "password"' | head -10 \
  || unzip -p "$ZIP" pages/login/login.js | grep -n 'ZQ-166b\|mode: "password"' | head -10
unzip -p "$ZIP" mp-weixin/pages/login/login.wxml 2>/dev/null | grep -n 'data-mp-wechat-login\|账号密码\|微信登录' | head -15 \
  || true
ls -la "$ZIP" "$BACKUP"
echo "DONE ZQ-166b mp-hide-wechat-login"
