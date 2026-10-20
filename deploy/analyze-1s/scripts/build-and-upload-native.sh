#!/usr/bin/env bash
# Rebuild APK + IPA + mp-weixin.zip from /opt/tennis-ai uni-app and publish to nginx.
# Requires Mac with Xcode (IPA) and Android SDK; run after apply-web.sh.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
OPT_ROOT="${OPT_ROOT:-/opt/tennis-ai}"
REMOTE_APK="${REMOTE_APK:-/var/www/apk}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
SKIP_IPA="${SKIP_IPA:-0}"
LOCAL_OUT="${LOCAL_OUT:-/tmp/analyze-1s-native-$$}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

mkdir -p "$LOCAL_OUT"

echo "== remote: build mp-weixin + Android APK on $WEB_HOST =="
"${SSH[@]}" "$WEB_HOST" "set -euo pipefail
  ROOT='$OPT_ROOT'
  UNI=\"\"
  for d in \"\$ROOT/apps/uniapp\" \"\$ROOT/uniapp\"; do
    [[ -d \"\$d\" ]] && UNI=\"\$d\" && break
  done
  [[ -n \"\$UNI\" ]] || { echo 'uniapp missing' >&2; exit 1; }
  cd \"\$UNI\"
  if [[ -f package.json ]]; then
    sudo -u tennis bash -lc \"cd '\$UNI' && npm ci --ignore-scripts 2>/dev/null || npm install\"
    sudo -u tennis bash -lc \"cd '\$UNI' && (npm run build:mp-weixin || npm run build:mp || true)\"
    sudo -u tennis bash -lc \"cd '\$UNI' && (npm run build:app || npm run build:h5 || true)\"
    if [[ -d native/android ]]; then
      sudo -u tennis bash -lc \"cd '\$UNI' && npm run sync:native 2>/dev/null || true\"
      if [[ -x native/android/gradlew ]]; then
        (cd native/android && ./gradlew assembleRelease assembleDebug 2>/dev/null || ./gradlew assembleDebug) || true
      fi
    fi
  fi
  # Collect artifacts
  OUT=/tmp/zq-native-out
  rm -rf \"\$OUT\" && mkdir -p \"\$OUT\"
  if [[ -d dist/build/mp-weixin ]]; then
    (cd dist/build && zip -qr \"\$OUT/mp-weixin.zip\" mp-weixin)
  elif [[ -d dist/mp-weixin ]]; then
    (cd dist && zip -qr \"\$OUT/mp-weixin.zip\" mp-weixin)
  fi
  APK=\$(find native/android -name '*.apk' 2>/dev/null | head -1 || true)
  if [[ -z \"\$APK\" ]]; then
    APK=\$(find \"\$UNI\" -name 'app-*-debug.apk' -o -name 'app-release.apk' 2>/dev/null | head -1 || true)
  fi
  if [[ -n \"\$APK\" ]]; then
    cp -a \"\$APK\" \"\$OUT/tennis-ai.apk\"
  fi
  ls -la \"\$OUT\"
"

"${SCP[@]}" "$WEB_HOST:/tmp/zq-native-out/mp-weixin.zip" "$LOCAL_OUT/" 2>/dev/null || echo "WARN: no mp-weixin.zip from server"
"${SCP[@]}" "$WEB_HOST:/tmp/zq-native-out/tennis-ai.apk" "$LOCAL_OUT/" 2>/dev/null || echo "WARN: no APK from server"

if [[ "$SKIP_IPA" != "1" ]]; then
  echo "== local IPA build (Xcode on Mac) =="
  # Prefer syncing www into thin-repo ios shell or uni native ios if present.
  IPA_SRC=""
  if [[ -d "$HOME/Downloads/tennis-ai/ios" ]]; then
    IPA_SRC="$HOME/Downloads/tennis-ai"
  fi
  # Fallback: pull uniapp www from server into local ios wrapper if available in this checkout
  REPO_IOS="$(cd "$(dirname "$0")/../../.." && pwd)/ios"
  if [[ -z "$IPA_SRC" && -d "$REPO_IOS/Zhangqiu.xcodeproj" ]]; then
    IPA_SRC="$(cd "$(dirname "$0")/../../.." && pwd)"
  fi
  if [[ -n "$IPA_SRC" && -x "$IPA_SRC/ios/build-ipa.sh" ]]; then
    (cd "$IPA_SRC" && bash ios/build-ipa.sh) || echo "WARN: IPA build failed"
    find "$IPA_SRC" -name 'tennis-ai.ipa' -o -name '*.ipa' 2>/dev/null | head -3
    IPA=$(find "$IPA_SRC" -name '*.ipa' 2>/dev/null | head -1 || true)
    [[ -n "$IPA" ]] && cp -a "$IPA" "$LOCAL_OUT/tennis-ai.ipa"
  else
    echo "WARN: no local IPA builder — place tennis-ai.ipa in $LOCAL_OUT before upload"
  fi
fi

cat > "$LOCAL_OUT/mp-weixin-README.txt" <<'EOF'
涨球微信小程序包（分析 ≤1s 快速路径）

1. 打开微信开发者工具 → 导入 mp-weixin.zip 解压后的目录。
2. AppID 可用测试号；真机前换成正式 AppID。
3. 短视频（≤6 秒）会带 fast=1；样例/相同内容命中缓存时直接出结果。
4. 完整长视频仍需数分钟（含回放与涨球教练），进度 ETA 以服务器为准。
EOF

echo "== upload four-surface artifacts to $WEB_HOST:$REMOTE_APK =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
for f in tennis-ai.apk tennis-ai.ipa mp-weixin.zip mp-weixin-README.txt; do
  if [[ -f "$LOCAL_OUT/$f" ]]; then
    chmod 644 "$LOCAL_OUT/$f"
    "${SCP[@]}" "$LOCAL_OUT/$f" "$WEB_HOST:$REMOTE_APK/$f"
    echo "uploaded $f"
  else
    echo "MISSING $LOCAL_OUT/$f — Mac must supply before public URLs update"
  fi
done

"${SSH[@]}" "$WEB_HOST" "chmod 644 $REMOTE_APK/tennis-ai.apk $REMOTE_APK/tennis-ai.ipa $REMOTE_APK/mp-weixin.zip $REMOTE_APK/mp-weixin-README.txt 2>/dev/null || true
  # Mirror common download paths
  for d in /usr/share/nginx/html /var/www/yqchen-downloads; do
    [[ -d \"\$d\" ]] || continue
    for f in tennis-ai.apk tennis-ai.ipa mp-weixin.zip mp-weixin-README.txt; do
      [[ -f $REMOTE_APK/\$f ]] && cp -a $REMOTE_APK/\$f \"\$d/\$f\" && chmod 644 \"\$d/\$f\"
    done
  done
"

echo "Native upload done. Public:"
echo "  https://yqchen.blog/tennis-ai.apk"
echo "  https://yqchen.blog/tennis-ai.ipa"
echo "  https://yqchen.blog/mp-weixin.zip"
echo "  https://yqchen.blog/mp-weixin-README.txt"
echo "Artifacts kept in $LOCAL_OUT"
