#!/usr/bin/env bash
# Run ON Yanqing's Mac — fills local WeChat DevTools project from prod zip.
set -euo pipefail
DEST="${LOCAL_MP_DIR:-$HOME/Downloads/mp-weixin (2)}"
ZIP_URL="${ZIP_URL:-https://yqchen.blog/mp-weixin.zip}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
echo "==> Download $ZIP_URL"
curl -fL "$ZIP_URL" -o "$TMP/mp-weixin.zip"
unzip -qo "$TMP/mp-weixin.zip" -d "$TMP/out"
SRC=""
if [[ -d "$TMP/out/mp-weixin" ]]; then SRC="$TMP/out/mp-weixin"
else SRC="$TMP/out"
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST/.zq-sync-backup-$STAMP"
cp -a "$DEST/app.json" "$DEST/.zq-sync-backup-$STAMP/" 2>/dev/null || true
cp -a "$DEST/pages" "$DEST/.zq-sync-backup-$STAMP/pages" 2>/dev/null || true
rsync -a --exclude '.zq-sync-backup-*' --exclude 'project.private.config.json' "$SRC"/ "$DEST"/
python3 - "$DEST" <<'PY'
import json, sys
from pathlib import Path
root=Path(sys.argv[1])
pages=json.loads((root/"app.json").read_text())["pages"]
print("first_page", pages[0])
w=(root/"pages/login/login.wxml").read_text()
print("has_wechat_login_chip", "微信登录" in w)
print("has_consent", "data-legal-consent" in w)
assert pages[0]=="pages/home/home"
assert "微信登录" not in w
print("OK", root)
PY
echo "DONE — open WeChat DevTools → 清缓存并编译 → project: $DEST"
