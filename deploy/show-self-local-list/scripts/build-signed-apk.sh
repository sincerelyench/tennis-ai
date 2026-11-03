#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
WWW_SRC="$REPO_ROOT/deploy/show-self-local-list/uniapp-www"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/show-self-local-list/dist}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js; do
  if [[ -f "$WWW_SRC/$f" ]]; then
    cp -f "$WWW_SRC/$f" "$ANDROID/app/src/main/assets/www/assets/$f"
    cp -f "$WWW_SRC/$f" "$ANDROID/app/src/main/assets/www/$f"
  fi
done

python3 - <<PY
from pathlib import Path
html = Path("$ANDROID/app/src/main/assets/www/index.html")
t = html.read_text() if html.exists() else ""
changed = False
for name in [
    "zq-friends-city-inject.js",
    "zq-friends-matchmaking-inject.js",
]:
    if name in t:
        continue
    if "</body>" in t:
        t = t.replace("</body>", f'  <script src="./assets/{name}"></script>\n</body>')
        changed = True
if changed and html.exists():
    html.write_text(t)
print("index wired")
PY

python3 - <<PY
from pathlib import Path
import re
p = Path("$ANDROID/app/build.gradle")
t = p.read_text()
t2 = re.sub(r"versionCode\s+\d+", "versionCode 195", t, count=1)
t2 = re.sub(r'versionName\s+"[^"]+"', 'versionName "1.0.95"', t2, count=1)
p.write_text(t2)
print("version -> 1.0.95 / 195")
PY

if [[ ! -f "$ANDROID/keystore.properties" && -f /Users/yanqing/Downloads/tennis-ai/android/keystore.properties ]]; then
  cp -f /Users/yanqing/Downloads/tennis-ai/android/keystore.properties "$ANDROID/keystore.properties"
fi
if [[ ! -f "$ANDROID/zhangqiu-release.jks" && -f /Users/yanqing/Downloads/tennis-ai/android/zhangqiu-release.jks ]]; then
  cp -f /Users/yanqing/Downloads/tennis-ai/android/zhangqiu-release.jks "$ANDROID/zhangqiu-release.jks"
fi
if [[ ! -f "$ANDROID/zhangqiu-release.jks" && -f /Users/yanqing/Downloads/tennis-ai-signed-release/android/zhangqiu-release.jks ]]; then
  cp -f /Users/yanqing/Downloads/tennis-ai-signed-release/android/zhangqiu-release.jks "$ANDROID/zhangqiu-release.jks"
  cp -f /Users/yanqing/Downloads/tennis-ai-signed-release/android/keystore.properties "$ANDROID/keystore.properties" 2>/dev/null || true
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
versionName=1.0.95
versionCode=195
applicationId=app.zhangqiu
built=$(date -u +%Y-%m-%dT%H:%M:%SZ)
signing=ZHANGQIU assembleRelease (no zip-inject)
feature=show-self-local-list
EOF
echo "APK -> $OUT_DIR/tennis-ai.apk"
