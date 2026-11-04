#!/usr/bin/env bash
# 涨球 · Mac four-surface release — apk-wechat-login
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/apk-wechat-login"
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

echo "==> [2/5] apply Next web patches (shared WeChat auth)"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] refresh mp-weixin.zip note (login API shared; MP UI owned by ZQ-32)"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-apk-wechat-login.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 apk-wechat-login $(date +%Y-%m-%d) — 共享 /api/auth/wechat；APK 1.0.101 微信登录按钮。小程序 UI 见 ZQ-32。" > APK-WECHAT-LOGIN-NOTE.txt
  zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
)
echo "  built $LOCAL_MP_ZIP"

echo "==> [4/5] upload APK/IPA/mp when provided"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
if [[ -z "$LOCAL_APK" && -f "$HERE/dist/tennis-ai.apk" ]]; then
  LOCAL_APK="$HERE/dist/tennis-ai.apk"
fi
if [[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  "${SSH[@]}" "$WEB_HOST" "cp -f '$REMOTE_APK/tennis-ai.apk' '$REMOTE_APK/tennis-ai-latest.apk' && chmod 644 '$REMOTE_APK/tennis-ai.apk' '$REMOTE_APK/tennis-ai-latest.apk'"
  echo "  APK uploaded"
else
  echo "  · APK not uploaded (set LOCAL_APK after assembleRelease)"
fi
if [[ -z "$LOCAL_IPA" && -f "$HERE/dist/tennis-ai.ipa" ]]; then
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK/tennis-ai.ipa'"
  echo "  IPA uploaded"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK/mp-weixin.zip'"
  echo "  mp-weixin.zip uploaded"
fi

echo "==> [5/5] verify"
"${SSH[@]}" "$WEB_HOST" 'ls -la /var/www/apk/tennis-ai.apk /var/www/apk/tennis-ai.ipa /var/www/apk/mp-weixin.zip 2>/dev/null; curl -sI https://yqchen.blog/tennis | head -5; curl -sI https://yqchen.blog/tennis-ai.apk | head -8; curl -sS -X POST http://127.0.0.1:43127/tennis/api/auth/wechat-app -H "content-type: application/json" -d "{\"code\":\"apk_verify\",\"client\":\"android\"}" | head -c 300; echo'
echo "done"
