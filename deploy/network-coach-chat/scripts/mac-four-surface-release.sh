#!/usr/bin/env bash
# 涨球 · Mac four-surface release — network coach chat
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/network-coach-chat"
REMOTE_APK=/var/www/apk
LOCAL_APK="${LOCAL_APK:-}"
LOCAL_IPA="${LOCAL_IPA:-}"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> [1/5] upload deploy package"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> [2/5] apply Next web patches + seed"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] refresh mp-weixin.zip"
if [[ -d "$REPO_ROOT/miniprogram/pages/coach" ]]; then
  LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-network-coach.zip}"
  (
    cd "$REPO_ROOT/miniprogram"
    printf '%s\n' "涨球 network-coach-chat $(date +%Y-%m-%d) APK 1.0.93" > NETWORK-COACH-NOTE.txt
    zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
  )
  echo "  built $LOCAL_MP_ZIP"
fi

echo "==> [4/5] upload APK/IPA/mp when provided"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
if [[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest.apk"
  echo "  uploaded signed APK"
else
  echo "  · APK not uploaded (set LOCAL_APK after assembleRelease)"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
fi
"${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai-latest.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip"

echo "==> [5/5] verify URLs"
for url in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis/coach" \
  "https://yqchen.blog/tennis/network-coach-chat.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" -L "$url" || echo "000")
  echo "  $code  $url"
done
echo "DONE network-coach-chat four-surface"
