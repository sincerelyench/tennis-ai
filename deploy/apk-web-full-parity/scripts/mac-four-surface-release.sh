#!/usr/bin/env bash
# 涨球 · Mac four-surface release — apk-web-full-parity
# Web is source of truth (no Next patch). Upload APK/IPA; leave mp-weixin to mp worker unless LOCAL_MP_ZIP set.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_APK=/var/www/apk
LOCAL_APK="${LOCAL_APK:-$HERE/dist/tennis-ai.apk}"
LOCAL_IPA="${LOCAL_IPA:-$HERE/dist/tennis-ai.ipa}"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-}"
NOTE="$HERE/dist/APK-WEB-FULL-PARITY-NOTE.txt"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> [1/3] ensure remote apk dir"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"

echo "==> [2/3] upload APK / IPA / note"
if [[ -f "$LOCAL_APK" ]]; then
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  "${SSH[@]}" "$WEB_HOST" "cp -f '$REMOTE_APK/tennis-ai.apk' '$REMOTE_APK/tennis-ai-latest.apk' && chmod 644 '$REMOTE_APK/tennis-ai.apk' '$REMOTE_APK/tennis-ai-latest.apk'"
  echo "  APK uploaded"
else
  echo "  · missing APK" >&2; exit 1
fi
if [[ -f "$LOCAL_IPA" ]]; then
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK/tennis-ai.ipa'"
  echo "  IPA uploaded"
fi
if [[ -f "$NOTE" ]]; then
  "${SCP[@]}" "$NOTE" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest.txt"
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK/tennis-ai-latest.txt'"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK/mp-weixin.zip'"
  echo "  mp-weixin.zip uploaded"
else
  echo "  · mp-weixin left to mp parity worker bc-678da1f4 (not overwritten)"
fi

echo "==> [3/3] verify"
"${SSH[@]}" "$WEB_HOST" 'ls -la /var/www/apk/tennis-ai.apk /var/www/apk/tennis-ai.ipa /var/www/apk/mp-weixin.zip /var/www/apk/tennis-ai-latest.txt 2>/dev/null; curl -sI https://yqchen.blog/tennis | head -5; curl -sI https://yqchen.blog/tennis-ai.apk | head -10; curl -s https://yqchen.blog/tennis-ai-latest.txt | head -8'
echo "done"
