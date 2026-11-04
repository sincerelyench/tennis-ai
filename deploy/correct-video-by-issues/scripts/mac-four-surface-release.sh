#!/usr/bin/env bash
# 涨球 · Mac four-surface release — correct-video-by-issues
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/correct-video-by-issues"
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

echo "==> [2/5] apply Next web patches"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] refresh mp-weixin.zip"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-correct-video-by-issues.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 correct-video-by-issues $(date +%Y-%m-%d) — 正确动作按问题点匹配示范；APK 1.0.100。" > CORRECT-VIDEO-BY-ISSUES-NOTE.txt
  if [[ -d "$HERE/mp-patch" ]]; then
    cp -a "$HERE/mp-patch/." .
  fi
  zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
)
echo "  built $LOCAL_MP_ZIP"

echo "==> [4/5] upload APK/IPA/mp when provided"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
if [[ -z "$LOCAL_APK" && -f "$HERE/dist/tennis-ai.apk" ]]; then
  LOCAL_APK="$HERE/dist/tennis-ai.apk"
fi
if [[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest.apk"
  echo "  uploaded signed APK"
else
  echo "  · APK not uploaded (set LOCAL_APK after assembleRelease)"
fi

# Refresh IPA www inject from prior signed IPA if needed
if [[ ! -f "$HERE/dist/tennis-ai.ipa" ]]; then
  BASE_IPA=""
  for cand in \
    "$REPO_ROOT/deploy/apk-web-align/dist/tennis-ai.ipa" \
    /Users/yanqing/Downloads/tennis-ai/deploy/tabs-swap-yueqiu/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/deploy/remove-profile-training/dist/tennis-ai.ipa
  do
    [[ -f "$cand" ]] && BASE_IPA="$cand" && break
  done
  if [[ -n "$BASE_IPA" ]]; then
    mkdir -p "$HERE/dist"
    IPA_STAGING=$(mktemp -d)
    unzip -q "$BASE_IPA" -d "$IPA_STAGING"
    WWW="$IPA_STAGING/Payload/Zhangqiu.app/www"
    mkdir -p "$WWW/assets"
    cp -f "$HERE/uniapp-www/zq-correct-by-issues-inject.js" "$WWW/assets/"
    cp -f "$HERE/uniapp-www/zq-correct-by-issues-inject.js" "$WWW/"
    python3 - <<PY
from pathlib import Path
www = Path("$WWW")
html = www / "index.html"
if html.exists():
    t = html.read_text(encoding="utf-8")
    name = "zq-correct-by-issues-inject.js"
    if name not in t and "</body>" in t:
        t = t.replace("</body>", f'  <script src="./assets/{name}"></script>\n</body>')
        html.write_text(t, encoding="utf-8")
        print("ipa www wired")
PY
    (cd "$IPA_STAGING" && zip -qr "$HERE/dist/tennis-ai.ipa" Payload)
    rm -rf "$IPA_STAGING"
    echo "  rebuilt IPA with inject"
  fi
fi

if [[ -z "$LOCAL_IPA" && -f "$HERE/dist/tennis-ai.ipa" ]]; then
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
  echo "  uploaded IPA"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
  echo "  uploaded mp-weixin.zip"
fi

echo "==> [5/5] verify URLs"
"${SSH[@]}" "$WEB_HOST" 'ls -la /var/www/apk/tennis-ai.apk /var/www/apk/tennis-ai.ipa /var/www/apk/mp-weixin.zip 2>/dev/null; curl -sI https://yqchen.blog/tennis | head -5; curl -sI https://yqchen.blog/tennis-ai.apk | head -8'
echo "==> four-surface release done"
