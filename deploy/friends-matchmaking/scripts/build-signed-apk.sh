#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
WWW_SRC="$REPO_ROOT/deploy/friends-matchmaking/uniapp-www"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/friends-matchmaking/dist}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

# Sync injects into embedded www
cp -f "$WWW_SRC/zq-friends-matchmaking-inject.js" "$ANDROID/app/src/main/assets/www/assets/zq-friends-matchmaking-inject.js"
cp -f "$WWW_SRC/zq-friends-matchmaking-inject.js" "$ANDROID/app/src/main/assets/www/zq-friends-matchmaking-inject.js"
if [[ -f "$WWW_SRC/zq-friends-city-inject.js" ]]; then
  cp -f "$WWW_SRC/zq-friends-city-inject.js" "$ANDROID/app/src/main/assets/www/assets/zq-friends-city-inject.js"
fi

python3 - <<PY
from pathlib import Path
html = Path("$ANDROID/app/src/main/assets/www/index.html")
t = html.read_text()
changed = False
if "zq-friends-matchmaking-inject.js" not in t:
    if "zq-friends-city-inject.js" in t:
        t = t.replace(
            '<script src="./assets/zq-friends-city-inject.js"></script>',
            '<script src="./assets/zq-friends-city-inject.js"></script>\n  <script src="./assets/zq-friends-matchmaking-inject.js"></script>',
        )
    else:
        t = t.replace("</body>", '  <script src="./assets/zq-friends-matchmaking-inject.js"></script>\n</body>')
    changed = True
if changed:
    html.write_text(t)
print("index wired")
PY

# Bump version in build.gradle for this feature release
python3 - <<PY
from pathlib import Path
p = Path("$ANDROID/app/build.gradle")
t = p.read_text()
t2 = t.replace("versionCode 192", "versionCode 193").replace('versionName "1.0.92"', 'versionName "1.0.93"')
t2 = t2.replace("versionCode 182", "versionCode 193").replace('versionName "1.0.82"', 'versionName "1.0.93"')
if 'versionName "1.0.93"' not in t2:
    import re
    t2 = re.sub(r"versionCode\s+\d+", "versionCode 193", t2, count=1)
    t2 = re.sub(r'versionName\s+"[^"]+"', 'versionName "1.0.93"', t2, count=1)
p.write_text(t2)
print("version -> 1.0.93 / 193")
PY

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
versionName=1.0.93
versionCode=193
applicationId=app.zhangqiu
built=$(date -u +%Y-%m-%dT%H:%M:%SZ)
signing=ZHANGQIU assembleRelease (no zip-inject)
feature=friends-matchmaking
EOF
echo "APK -> $OUT_DIR/tennis-ai.apk"
