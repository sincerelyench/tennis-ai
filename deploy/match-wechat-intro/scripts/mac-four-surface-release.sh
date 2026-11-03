#!/usr/bin/env bash
# 涨球 · Mac four-surface release — match WeChat intro
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/match-wechat-intro"
REMOTE_APK=/var/www/apk
LOCAL_APK="${LOCAL_APK:-}"
LOCAL_IPA="${LOCAL_IPA:-}"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing SSHPASS / Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> [1/5] upload deploy package"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> [2/5] apply Next web patches"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] refresh mp-weixin.zip"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-match-wechat-intro.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 match-wechat-intro $(date +%Y-%m-%d) APK 1.0.97 — 匹配成功微信引导；取消后重匹配/搜索挑战。" > FRIENDS-MATCH-WECHAT-INTRO-NOTE.txt
  if [[ -d "$HERE/mp-patch" ]]; then
    cp -a "$HERE/mp-patch/." .
  fi
  zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
)
echo "  built $LOCAL_MP_ZIP"


echo "==> [3.5/5] refresh IPA WebView shell injects"
if [[ ! -f "$HERE/dist/tennis-ai.ipa" ]]; then
  BASE_IPA=""
  for cand in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/deploy/remove-profile-training/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-profile-location/deploy/profile-change-location/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-friends-score-confirm/deploy/friends-score-confirm/dist/tennis-ai.ipa
  do
    [[ -f "$cand" ]] && BASE_IPA="$cand" && break
  done
  if [[ -n "$BASE_IPA" ]]; then
    mkdir -p "$HERE/dist"
    IPA_STAGING=$(mktemp -d)
    unzip -q "$BASE_IPA" -d "$IPA_STAGING"
    WWW="$IPA_STAGING/Payload/Zhangqiu.app/www"
    mkdir -p "$WWW/assets"
    for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js; do
      [[ -f "$HERE/uniapp-www/$f" ]] || continue
      cp -f "$HERE/uniapp-www/$f" "$WWW/assets/$f"
      cp -f "$HERE/uniapp-www/$f" "$WWW/$f"
    done
    python3 -c "
from pathlib import Path
html = Path(r'$WWW') / 'index.html'
if html.exists():
    t = html.read_text()
    changed = False
    for name in ['zq-friends-city-inject.js', 'zq-friends-matchmaking-inject.js']:
        if name in t: continue
        if '</body>' in t:
            t = t.replace('</body>', f'  <script src=\"./assets/{name}\"></script>\n</body>')
            changed = True
    if changed: html.write_text(t)
"
    printf '%s\n' "match-wechat-intro 1.0.97 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$IPA_STAGING/Payload/Zhangqiu.app/MATCH-WECHAT-INTRO.txt"
    ( cd "$IPA_STAGING" && zip -qr "$HERE/dist/tennis-ai.ipa" Payload )
    shasum -a 256 "$HERE/dist/tennis-ai.ipa" | tee "$HERE/dist/IPA-SHA256.txt"
    echo "IPA WebView shell refreshed with match-wechat-intro injects." > "$HERE/dist/IPA-NOTE.txt"
    echo "  built refreshed IPA from baseline shell"
  fi
fi

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
if [[ -z "$LOCAL_IPA" && -f "$HERE/dist/tennis-ai.ipa" ]]; then
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
fi

if [[ -d "$REPO_ROOT/ios/Zhangqiu/www" ]]; then
  for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js; do
    [[ -f "$HERE/uniapp-www/$f" ]] || continue
    mkdir -p "$REPO_ROOT/ios/Zhangqiu/www/assets"
    cp -f "$HERE/uniapp-www/$f" "$REPO_ROOT/ios/Zhangqiu/www/assets/$f"
    cp -f "$HERE/uniapp-www/$f" "$REPO_ROOT/ios/Zhangqiu/www/$f"
  done
fi

"${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai-latest.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip"

echo "==> [5/5] smoke URLs"
for u in \
  https://yqchen.blog/tennis \
  https://yqchen.blog/tennis-ai.apk \
  https://yqchen.blog/tennis-ai.ipa \
  https://yqchen.blog/mp-weixin.zip
do
  code=$(curl -sI -o /dev/null -w '%{http_code}' "$u" || true)
  echo "  $code $u"
done
echo "DONE four-surface match-wechat-intro"
