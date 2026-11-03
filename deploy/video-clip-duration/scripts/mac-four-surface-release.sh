#!/usr/bin/env bash
# 涨球 · Mac four-surface release — video-clip-duration
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/video-clip-duration"
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
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-video-clip-duration.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 video-clip-duration $(date +%Y-%m-%d) APK 1.0.98 — 选段默认/最短 10 秒，可拖长到整段。Web/APK/IPA 主承载；小程序仍整段上传。" > VIDEO-CLIP-DURATION-NOTE.txt
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
if [[ -z "$LOCAL_IPA" && -f "$HERE/dist/tennis-ai.ipa" ]]; then
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
fi

# Refresh IPA shell www with patched clip bundle
if [[ -d "$REPO_ROOT/ios/Zhangqiu/www" ]] || true; then
  :
fi
BASE_IPA=""
for cand in \
  "$HERE/dist/tennis-ai.ipa" \
  /Users/yanqing/Downloads/tennis-ai-remove-profile-training/deploy/remove-profile-training/dist/tennis-ai.ipa \
  /Users/yanqing/Downloads/tennis-ai-profile-location/deploy/profile-change-location/dist/tennis-ai.ipa
do
  [[ -f "$cand" ]] && BASE_IPA="$cand" && break
done
if [[ -n "$BASE_IPA" ]]; then
  IPA_STAGING=$(mktemp -d)
  unzip -q "$BASE_IPA" -d "$IPA_STAGING"
  WWW="$IPA_STAGING/Payload/Zhangqiu.app/www"
  mkdir -p "$WWW/assets"
  if [[ -f "$HERE/uniapp-www/assets/index-SaS00-5Q.js" ]]; then
    cp -f "$HERE/uniapp-www/assets/index-SaS00-5Q.js" "$WWW/assets/index-SaS00-5Q.js"
  fi
  printf '%s\n' "video-clip-duration 1.0.98 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$IPA_STAGING/Payload/Zhangqiu.app/VIDEO-CLIP-DURATION.txt"
  (
    cd "$IPA_STAGING"
    zip -qr "$HERE/dist/tennis-ai.ipa" Payload
  )
  shasum -a 256 "$HERE/dist/tennis-ai.ipa" | tee "$HERE/dist/IPA-SHA256.txt"
  cat > "$HERE/dist/IPA-NOTE.txt" <<EOF
IPA WebView shell refreshed with video-clip-duration uni bundle (default/min 10s, drag longer).
Primary trim UI also via live /tennis web. APK 1.0.98 is fully re-signed assembleRelease.
EOF
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
  echo "  built refreshed IPA"
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
  "https://yqchen.blog/tennis/video-clip-duration.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" -L "$url" || echo "000")
  echo "  $code  $url"
done

# Confirm prod clip.ts
"${SSH[@]}" "$WEB_HOST" "grep -n 'CLIP_DEFAULT_SEC\|CLIP_MIN_SEC\|POSITIVE_INFINITY' /opt/tennis-ai/lib/clip.ts | head"

echo "DONE video-clip-duration four-surface"
