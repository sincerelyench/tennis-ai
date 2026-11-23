#!/usr/bin/env bash
# Run ON Yanqing's Mac — overwrite local DevTools with password-only MP (no WeChat / phone).
set -euo pipefail
DEST="${LOCAL_MP_DIR:-$HOME/Downloads/mp-weixin}"
BRANCH="${BRANCH:-cursor/mp-remove-signup-role-7086}"
REPO_URL="${REPO_URL:-https://github.com/sincerelyench/tennis-ai.git}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Clone $BRANCH"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"
SRC="$TMP/repo/deploy/mp-local-devtools-sync/project"
[[ -f "$SRC/pages/login/login.wxml" ]] || { echo "missing login.wxml"; exit 1; }

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST/.zq-sync-backup-$STAMP"
cp -a "$DEST/app.json" "$DEST/.zq-sync-backup-$STAMP/" 2>/dev/null || true
cp -a "$DEST/pages" "$DEST/.zq-sync-backup-$STAMP/pages" 2>/dev/null || true

echo "==> Copy -> $DEST"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude '.zq-sync-backup-*' --exclude 'project.private.config.json' "$SRC"/ "$DEST"/
else
  # fallback without rsync
  find "$DEST" -mindepth 1 -maxdepth 1 ! -name '.zq-sync-backup-*' ! -name 'project.private.config.json' -exec rm -rf {} +
  cp -a "$SRC"/. "$DEST"/
fi

python3 - "$DEST" <<'PY'
from pathlib import Path
import json, sys
root = Path(sys.argv[1])
pages = json.loads((root / "app.json").read_text())["pages"]
w = (root / "pages/login/login.wxml").read_text()
js = (root / "pages/login/login.js").read_text()
print("first_page", pages[0])
print("has_wechat_chip", "微信登录" in w)
print("has_phone_chip", "手机验证码" in w)
print("password_only", 'data-login-mode="password-only"' in w)
assert pages[0] == "pages/home/home"
assert "微信登录" not in w
assert "手机验证码" not in w
assert "onWechatLogin" not in js
assert "onPhoneLogin" not in js
print("OK", root)
PY

echo "DONE — 微信开发者工具：打开 $DEST → 清缓存 → 编译"
echo "登录页应只有：协议勾选 + 用户名 + 密码（无微信、无手机验证码）"
