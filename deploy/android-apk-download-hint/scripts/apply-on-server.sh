#!/usr/bin/env bash
# Soft Android APK download hint for phone browsers (not ZhangqiuAndroid shell).
# Usage:
#   SSHPASS=… bash deploy/android-apk-download-hint/scripts/apply-on-server.sh
# Or on host after scp:
#   bash /tmp/android-apk-download-hint/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${1:-}"
NAME="android-apk-download-hint"

apply_local() {
  local root="$1"
  local stamp bak
  stamp="$(date +%Y%m%d-%H%M%S)"
  bak="$root/.$NAME-backup-$stamp"
  mkdir -p "$bak/components" "$bak/lib/i18n"

  for f in app-shell.tsx login-view.tsx profile-view.tsx android-apk-hint.tsx; do
    if [[ -f "$root/components/$f" ]]; then
      cp -a "$root/components/$f" "$bak/components/"
    fi
  done
  if [[ -f "$root/lib/android-apk.ts" ]]; then
    cp -a "$root/lib/android-apk.ts" "$bak/lib/"
  fi
  cp -a "$root/lib/i18n/messages.ts" "$bak/lib/i18n/"

  mkdir -p "$root/components" "$root/lib/i18n"
  cp -a "$DIR/opt-patch/components/android-apk-hint.tsx" "$root/components/android-apk-hint.tsx"
  cp -a "$DIR/opt-patch/components/app-shell.tsx" "$root/components/app-shell.tsx"
  cp -a "$DIR/opt-patch/components/login-view.tsx" "$root/components/login-view.tsx"
  cp -a "$DIR/opt-patch/components/profile-view.tsx" "$root/components/profile-view.tsx"
  cp -a "$DIR/opt-patch/lib/android-apk.ts" "$root/lib/android-apk.ts"
  cp -a "$DIR/opt-patch/lib/i18n/messages.ts" "$root/lib/i18n/messages.ts"

  chown -R tennis:tennis \
    "$root/components/android-apk-hint.tsx" \
    "$root/components/app-shell.tsx" \
    "$root/components/login-view.tsx" \
    "$root/components/profile-view.tsx" \
    "$root/lib/android-apk.ts" \
    "$root/lib/i18n/messages.ts"

  if [[ -f "$DIR/mp-patch/ANDROID-APK-DOWNLOAD-HINT-NOTE.txt" ]]; then
    cp -a "$DIR/mp-patch/ANDROID-APK-DOWNLOAD-HINT-NOTE.txt" /var/www/apk/
    chmod 644 /var/www/apk/ANDROID-APK-DOWNLOAD-HINT-NOTE.txt || true
  fi
  if [[ -f "$DIR/preview/android-apk-download-hint.html" ]]; then
    cp -a "$DIR/preview/android-apk-download-hint.html" /var/www/apk/
    chmod 644 /var/www/apk/android-apk-download-hint.html || true
  fi

  sudo -u tennis bash -lc "cd '$root' && npx next build --webpack"
  systemctl restart tennis-ai
  sleep 2
  systemctl is-active tennis-ai
  echo "DONE local apply backup=$bak"
}

if [[ -n "$ROOT" ]]; then
  apply_local "$ROOT"
  exit 0
fi

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
export SSHPASS="${SSHPASS:-$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)}"
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS / keychain $KEYCHAIN_SERVICE missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_OPT=/opt/tennis-ai
REMOTE_TMP="/tmp/$NAME-$STAMP"

echo "== upload bundle =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$DIR/opt-patch" "$DIR/scripts" "$DIR/mp-patch" "$DIR/preview" "$WEB_HOST:$REMOTE_TMP/"

echo "== apply on server =="
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' '$REMOTE_OPT'"

echo "== probe =="
HTML="$(curl -sS 'https://yqchen.blog/tennis/login')"
echo "$HTML" | grep -q 'android-apk-hint\|apkHint\|Download\|安卓' || true
curl -sI 'https://yqchen.blog/tennis-ai.apk' | head -5
echo "DONE $STAMP"
