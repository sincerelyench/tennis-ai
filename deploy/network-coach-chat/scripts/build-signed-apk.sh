#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
WWW_SRC="$REPO_ROOT/deploy/network-coach-chat/uniapp-www"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/network-coach-chat/dist}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

# Sync inject into embedded www (keep existing uni-app assets)
cp -f "$WWW_SRC/zq-network-coach-inject.js" "$ANDROID/app/src/main/assets/www/assets/zq-network-coach-inject.js"
cp -f "$WWW_SRC/zq-network-coach-inject.js" "$ANDROID/app/src/main/assets/www/zq-network-coach-inject.js"
if [[ -f "$WWW_SRC/index.html" ]]; then
  # Prefer existing www index (has other injects); only ensure our script tag
  python3 - <<PY
from pathlib import Path
html = Path("$ANDROID/app/src/main/assets/www/index.html")
t = html.read_text()
if "zq-network-coach-inject.js" not in t:
    if "zq-match-record-inject.js" in t:
        t = t.replace(
            '<script src="./assets/zq-match-record-inject.js"></script>',
            '<script src="./assets/zq-match-record-inject.js"></script>\n  <script src="./assets/zq-network-coach-inject.js"></script>',
        )
    else:
        t = t.replace("</body>", '  <script src="./assets/zq-network-coach-inject.js"></script>\n</body>')
    html.write_text(t)
print("index wired")
PY
fi

cd "$ANDROID"
chmod +x gradlew 2>/dev/null || true
./gradlew assembleRelease --no-daemon

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
versionName=1.0.92
versionCode=192
applicationId=app.zhangqiu
built=$(date -u +%Y-%m-%dT%H:%M:%SZ)
signing=ZHANGQIU assembleRelease (no zip-inject)
EOF
echo "APK -> $OUT_DIR/tennis-ai.apk"
