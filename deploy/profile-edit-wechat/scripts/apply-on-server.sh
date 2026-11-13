#!/usr/bin/env bash
# ZQ-128/129: 个人资料可编辑微信号 + Android APK 去掉微信登录入口。
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.profile-edit-wechat-backup-$STAMP"
LOCK="/tmp/tennis-ai-deploy.lock"

acquire_lock() {
  if mkdir "$LOCK" 2>/dev/null; then
    return 0
  fi
  if [[ -f "$LOCK" && ! -s "$LOCK" ]] && ! pgrep -af 'next build' >/dev/null 2>&1; then
    echo "WARN: clearing stale empty file lock $LOCK"
    rm -f "$LOCK"
    mkdir "$LOCK"
    return 0
  fi
  echo "ABORT: another deploy holds $LOCK" >&2
  ls -la "$LOCK" >&2 || true
  return 1
}

if pgrep -af 'next build' | grep -v "$$" >/dev/null 2>&1; then
  echo "ABORT: next build already running" >&2
  pgrep -af 'next build' >&2 || true
  exit 1
fi

acquire_lock || exit 1
trap 'rm -rf "$LOCK" 2>/dev/null || true' EXIT

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components"
cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/"
cp -a "$ROOT/components/login-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (profile-view + login-view)"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/login-view.tsx" "$ROOT/components/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p /var/www/apk "$ROOT/public"
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/profile-edit-wechat.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/profile-edit-wechat.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/PROFILE-EDIT-WECHAT-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/PROFILE-EDIT-WECHAT-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

chown tennis:tennis "$ROOT/components/profile-view.tsx" "$ROOT/components/login-view.tsx" 2>/dev/null || true
chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
cd "$ROOT"
sudo -u tennis -H bash -lc 'npx next build --webpack'
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -fsS -o /dev/null -w 'local-login %{http_code}\n' http://127.0.0.1:43127/tennis/login || \
  curl -fsS -o /dev/null -w 'local-login %{http_code}\n' http://127.0.0.1:3000/tennis/login || true
echo "Done. backup=$BACKUP"
