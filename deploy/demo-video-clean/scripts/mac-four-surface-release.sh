#!/usr/bin/env bash
# 涨球 · Mac four-surface release for clean demo chrome
# Run on yanqingMacBook Pro (Keychain voice-diary-prod-ssh + sshpass).
#
# 1) Apply Next + uni-app patches on 8.216.53.29:/opt/tennis-ai
# 2) Rebuild web; strip chrome in APK/IPA archives on server
# 3) Rebuild/upload mp-weixin.zip
# 4) Optionally rebuild local APK/IPA and upload
#
# Usage:
#   bash deploy/demo-video-clean/scripts/mac-four-surface-release.sh
#   HOST=root@8.216.53.29 LOCAL_APK=~/path/tennis-ai.apk LOCAL_IPA=~/path/tennis-ai.ipa \
#     bash deploy/demo-video-clean/scripts/mac-four-surface-release.sh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

HOST="${HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/demo-video-clean"
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

echo "==> [1/4] upload deploy package → $HOST:$REMOTE_TMP"
"${SSH[@]}" "$HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$HOST:$REMOTE_TMP/"

echo "==> [2/4] apply web + uni-app + strip APK/IPA + rebuild Next/mp on server"
"${SSH[@]}" "$HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

# Optional: rebuild uni-app on Mac if HBuilder / uni CLI present and source checkout exists
UNI_SRC="${UNI_SRC:-}"
for cand in \
  "$UNI_SRC" \
  "$HOME/tennis-ai/apps/uniapp" \
  "$REPO_ROOT/apps/uniapp" \
  "/opt/tennis-ai/apps/uniapp"
do
  if [[ -n "$cand" && -d "$cand" ]]; then
    UNI_SRC="$cand"
    break
  fi
done

if [[ -n "$UNI_SRC" && -d "$UNI_SRC" ]]; then
  echo "==> local uni-app rebuild attempt: $UNI_SRC"
  # Drop clean components into local tree if this is a writable checkout
  if [[ -w "$UNI_SRC/src" || -w "$UNI_SRC" ]]; then
    mkdir -p "$UNI_SRC/src/components" "$UNI_SRC/src/lib" "$UNI_SRC/src/pages/star-demo-embed"
    cp -f "$HERE/opt-patch/apps/uniapp/src/components/star-demo-player.vue" "$UNI_SRC/src/components/" 2>/dev/null || true
    cp -f "$HERE/opt-patch/apps/uniapp/src/lib/star-demos.ts" "$UNI_SRC/src/lib/" 2>/dev/null || true
    cp -f "$HERE/opt-patch/apps/uniapp/src/pages/star-demo-embed/star-demo-embed.vue" \
      "$UNI_SRC/src/pages/star-demo-embed/" 2>/dev/null || true
  fi
  (
    cd "$UNI_SRC"
    npm run build:mp-weixin 2>/tmp/zq-mac-mp.log || npx uni build -p mp-weixin 2>>/tmp/zq-mac-mp.log || true
    npm run build:app 2>>/tmp/zq-mac-mp.log || npx uni build -p app 2>>/tmp/zq-mac-mp.log || true
  ) || true
  for d in "$UNI_SRC/dist/build/mp-weixin" "$UNI_SRC/dist/dev/mp-weixin"; do
    if [[ -f "$d/app.json" ]]; then
      LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-clean.zip}"
      (cd "$d" && zip -qr "$LOCAL_MP_ZIP" .)
      echo "  built $LOCAL_MP_ZIP"
      break
    fi
  done
fi

# Optional local native rebuilds
if [[ -z "$LOCAL_APK" && -x "$REPO_ROOT/android/gradlew" ]]; then
  echo "==> local Android assembleRelease (best-effort)"
  (cd "$REPO_ROOT/android" && ./gradlew assembleRelease) && \
    LOCAL_APK="$(ls -1t "$REPO_ROOT/android/app/build/outputs/apk/release"/*.apk 2>/dev/null | head -1 || true)"
fi
if [[ -z "$LOCAL_IPA" && -x "$REPO_ROOT/ios/build-ipa.sh" ]]; then
  echo "==> local iOS IPA (best-effort)"
  (cd "$REPO_ROOT/ios" && bash build-ipa.sh) && \
    LOCAL_IPA="$(ls -1t "$REPO_ROOT/ios"/build/*.ipa "$REPO_ROOT/ios"/*.ipa 2>/dev/null | head -1 || true)"
fi

echo "==> [3/4] upload client artifacts (APK / IPA / mp-weixin.zip)"
"${SSH[@]}" "$HOST" "mkdir -p '$REMOTE_APK'"
UPLOADED=0
if [[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$HOST:$REMOTE_APK/tennis-ai.apk"
  UPLOADED=1
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$HOST:$REMOTE_APK/tennis-ai.ipa"
  UPLOADED=1
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$HOST:$REMOTE_APK/mp-weixin.zip"
  UPLOADED=1
fi
if [[ "$UPLOADED" -eq 1 ]]; then
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true"
else
  echo "  (no local APK/IPA/mp zip — server apply still stripped archives + zipped mp when possible)"
fi

echo "==> [4/4] verify four public URLs"
for u in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip" \
  "https://yqchen.blog/demo-video-clean-preview.html" \
  "https://yqchen.blog/tennis/demo-video-clean-preview.html"
do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$u" || echo err)
  len=$(curl -sS -o /dev/null -w "%{size_download}" -L --max-time 20 "$u" || echo 0)
  echo "  $code  $len  $u"
done

echo
echo "Done. Spot-check analysis demo: technique dropdown + video only (no 萨巴伦卡 credit / 换源 / 打开B站)."
echo "Evidence → media/demo-video-clean-20261020/ (01-clean-demo.png …)"
