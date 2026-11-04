#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/apk-web-full-parity/dist}"
VERSION_NAME="${VERSION_NAME:-1.0.102}"
VERSION_CODE="${VERSION_CODE:-202}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$OUT_DIR"

if [[ ! -f "$ANDROID/keystore.properties" && -f /Users/yanqing/Downloads/tennis-ai/android/keystore.properties ]]; then
  cp -f /Users/yanqing/Downloads/tennis-ai/android/keystore.properties "$ANDROID/keystore.properties"
fi
if [[ ! -f "$ANDROID/zhangqiu-release.jks" && -f /Users/yanqing/Downloads/tennis-ai/android/zhangqiu-release.jks ]]; then
  cp -f /Users/yanqing/Downloads/tennis-ai/android/zhangqiu-release.jks "$ANDROID/zhangqiu-release.jks"
fi

python3 - <<PY
from pathlib import Path
import re
p = Path("$ANDROID/app/build.gradle")
t = p.read_text()
t = re.sub(r"versionCode\s+\d+", "versionCode $VERSION_CODE", t, count=1)
t = re.sub(r'versionName\s+"[^"]+"', 'versionName "$VERSION_NAME"', t, count=1)
p.write_text(t)
print("version -> $VERSION_NAME / $VERSION_CODE")
PY

cd "$ANDROID"
chmod +x gradlew 2>/dev/null || true
if [[ -n "${ZQ_WECHAT_APP_ID:-}" ]]; then
  ./gradlew assembleRelease --no-daemon "-PZQ_WECHAT_APP_ID=$ZQ_WECHAT_APP_ID"
else
  ./gradlew assembleRelease --no-daemon
fi

APK="$ANDROID/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK" ]] || APK="$ANDROID/app/build/outputs/apk/release/app-release-unsigned.apk"
cp -f "$APK" "$OUT_DIR/tennis-ai.apk"
chmod 644 "$OUT_DIR/tennis-ai.apk"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
APKSIGNER=$(ls -d "$SDK"/build-tools/*/apksigner 2>/dev/null | tail -1)
AAPT=$(ls -d "$SDK"/build-tools/*/aapt 2>/dev/null | tail -1)
"$APKSIGNER" verify --verbose "$OUT_DIR/tennis-ai.apk" | tee "$OUT_DIR/apksigner.txt"
"$AAPT" dump badging "$OUT_DIR/tennis-ai.apk" | head -3 | tee "$OUT_DIR/badging.txt"
shasum -a 256 "$OUT_DIR/tennis-ai.apk" | tee "$OUT_DIR/SHA256.txt"
cat > "$OUT_DIR/VERSION.txt" <<EOF
versionName=$VERSION_NAME
versionCode=$VERSION_CODE
applicationId=app.zhangqiu
built=$(date -u +%Y-%m-%dT%H:%M:%SZ)
signing=ZHANGQIU assembleRelease (no zip-inject)
feature=apk-web-full-parity
wechatAppIdSet=${ZQ_WECHAT_APP_ID:+yes}
packageSignatureMD5=18ebdb408990a7e30bafd0c43bc7c390
EOF
echo "APK -> $OUT_DIR/tennis-ai.apk"
