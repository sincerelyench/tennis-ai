#!/usr/bin/env bash
# Rebuild / upload APK + IPA + mp-weixin.zip to 8.216 /var/www/apk
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

HOST="${HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_APK="${REMOTE_APK:-/var/www/apk}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
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

if [[ -n "$UNI_SRC" ]]; then
  echo "== uni-app patch + rebuild: $UNI_SRC"
  mkdir -p "$UNI_SRC/src/components" 2>/dev/null || mkdir -p "$UNI_SRC/components" 2>/dev/null || true
  cp -f "$HERE/uniapp-patch/components/report-four-dim.vue" "$UNI_SRC/src/components/" 2>/dev/null \
    || cp -f "$HERE/uniapp-patch/components/report-four-dim.vue" "$UNI_SRC/components/" 2>/dev/null || true
  (
    cd "$UNI_SRC"
    npm run build:mp-weixin 2>/tmp/zq-fd-mp.log || npx uni build -p mp-weixin 2>>/tmp/zq-fd-mp.log || true
    npm run build:app 2>>/tmp/zq-fd-mp.log || npx uni build -p app 2>>/tmp/zq-fd-mp.log || true
  ) || true
  for d in "$UNI_SRC/dist/build/mp-weixin" "$UNI_SRC/dist/dev/mp-weixin"; do
    if [[ -f "$d/app.json" ]]; then
      LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-four-dim.zip}"
      (cd "$d" && zip -qr "$LOCAL_MP_ZIP" .)
      echo "  built $LOCAL_MP_ZIP"
      break
    fi
  done
fi

# Thin-repo miniprogram fallback zip
if [[ -z "${LOCAL_MP_ZIP:-}" || ! -f "${LOCAL_MP_ZIP:-}" ]]; then
  if [[ -f "$REPO_ROOT/miniprogram/app.json" ]]; then
    LOCAL_MP_ZIP="/tmp/mp-weixin-four-dim-thin.zip"
    (cd "$REPO_ROOT/miniprogram" && zip -qr "$LOCAL_MP_ZIP" .)
    echo "  thin mp zip $LOCAL_MP_ZIP"
  fi
fi

if [[ -z "$LOCAL_APK" && -x "$REPO_ROOT/android/gradlew" ]]; then
  (cd "$REPO_ROOT/android" && ./gradlew assembleRelease) && \
    LOCAL_APK="$(ls -1t "$REPO_ROOT/android/app/build/outputs/apk/release"/*.apk 2>/dev/null | head -1 || true)"
fi
if [[ -z "$LOCAL_IPA" && -x "$REPO_ROOT/ios/build-ipa.sh" ]]; then
  (cd "$REPO_ROOT/ios" && bash build-ipa.sh) && \
    LOCAL_IPA="$(ls -1t "$REPO_ROOT/ios"/build/*.ipa "$REPO_ROOT/ios"/*.ipa 2>/dev/null | head -1 || true)"
fi

echo "== upload natives → $HOST:$REMOTE_APK"
"${SSH[@]}" "$HOST" "mkdir -p '$REMOTE_APK'"
UP=0
if [[ -n "${LOCAL_APK:-}" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$HOST:$REMOTE_APK/tennis-ai.apk"
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_APK/tennis-ai.apk'"
  echo "  + tennis-ai.apk"; UP=1
fi
if [[ -n "${LOCAL_IPA:-}" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$HOST:$REMOTE_APK/tennis-ai.ipa"
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_APK/tennis-ai.ipa'"
  echo "  + tennis-ai.ipa"; UP=1
fi
if [[ -n "${LOCAL_MP_ZIP:-}" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$HOST:$REMOTE_APK/mp-weixin.zip"
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_APK/mp-weixin.zip'"
  # README
  README=/tmp/mp-weixin-README-four-dim.txt
  cat >"$README" <<EOF
涨球微信小程序包（mp-weixin.zip）
含报告页四维评分 + 速度估计 + 雷达/条形图。
用微信开发者工具导入解压目录即可预览。
品牌：涨球 · 教练：涨球教练
EOF
  "${SCP[@]}" "$README" "$HOST:$REMOTE_APK/mp-weixin-README.txt"
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_APK/mp-weixin-README.txt'"
  echo "  + mp-weixin.zip"; UP=1
fi

# Server-side strip/rebuild fallback: re-zip mp from /opt if local missing
if [[ "$UP" -eq 0 ]]; then
  echo "No local artifacts — attempting server-side mp-weixin zip from /opt/tennis-ai"
  "${SSH[@]}" "$HOST" "set -euo pipefail
    for d in /opt/tennis-ai/apps/uniapp/dist/build/mp-weixin /opt/tennis-ai/miniprogram; do
      if [[ -f \$d/app.json ]]; then
        (cd \$d && zip -qr /var/www/apk/mp-weixin.zip .)
        chmod 644 /var/www/apk/mp-weixin.zip
        echo zipped \$d
        exit 0
      fi
    done
    echo 'WARN: no mp-weixin source on server' >&2
  "
fi
echo native upload done
