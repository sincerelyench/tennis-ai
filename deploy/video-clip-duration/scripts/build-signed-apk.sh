#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
WWW_SRC="$REPO_ROOT/deploy/video-clip-duration/uniapp-www"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/video-clip-duration/dist}"
VERSION_NAME="1.0.98"
VERSION_CODE="198"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

# Prefer fuller www from recent release worktree
if [[ ! -f "$ANDROID/app/src/main/assets/www/index.html" ]]; then
  for cand in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android/app/src/main/assets/www \
    /Users/yanqing/Downloads/tennis-ai-profile-location/android/app/src/main/assets/www \
    /Users/yanqing/Downloads/tennis-ai-friends-score-confirm/android/app/src/main/assets/www
  do
    if [[ -f "$cand/index.html" ]]; then
      cp -a "$cand/." "$ANDROID/app/src/main/assets/www/"
      break
    fi
  done
fi

# Ensure android project/signing exists
if [[ ! -f "$ANDROID/app/build.gradle" ]]; then
  for cand in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android \
    /Users/yanqing/Downloads/tennis-ai-profile-location/android
  do
    if [[ -f "$cand/app/build.gradle" ]]; then
      mkdir -p "$ANDROID"
      rsync -a --exclude 'build' --exclude '.gradle' --exclude 'app/build' "$cand/" "$ANDROID/"
      break
    fi
  done
fi

if [[ -f "$WWW_SRC/assets/index-SaS00-5Q.js" ]]; then
  mkdir -p "$ANDROID/app/src/main/assets/www/assets"
  cp -f "$WWW_SRC/assets/index-SaS00-5Q.js" "$ANDROID/app/src/main/assets/www/assets/index-SaS00-5Q.js"
fi

# Carry forward prior injects already in www/index.html; no new inject required
# (clip rules patched inside index-SaS00-5Q.js).

python3 - <<PY
from pathlib import Path
import re
p = Path("$ANDROID/app/build.gradle")
t = p.read_text()
t2 = re.sub(r"versionCode\s+\d+", "versionCode $VERSION_CODE", t, count=1)
t2 = re.sub(r'versionName\s+"[^"]+"', 'versionName "$VERSION_NAME"', t2, count=1)
# Prefer live tennis web for analysis trimmer
if "ZQ_START_URL" in t2 and "yqchen.blog/tennis" not in t2:
    t2 = t2.replace(
        'project.findProperty("ZQ_START_URL") ?: "https://tennis.47.93.203.28.sslip.io/e1"',
        'project.findProperty("ZQ_START_URL") ?: "https://yqchen.blog/tennis"',
    )
p.write_text(t2)
print("version -> $VERSION_NAME / $VERSION_CODE")
PY

if [[ ! -f "$ANDROID/keystore.properties" ]]; then
  for base in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android \
    /Users/yanqing/Downloads/tennis-ai-profile-location/android \
    /Users/yanqing/Downloads/tennis-ai-signed-release/android
  do
    if [[ -f "$base/keystore.properties" ]]; then
      cp -f "$base/keystore.properties" "$ANDROID/keystore.properties"
      cp -f "$base/zhangqiu-release.jks" "$ANDROID/zhangqiu-release.jks" 2>/dev/null || true
      break
    fi
  done
fi
if [[ ! -f "$ANDROID/zhangqiu-release.jks" ]]; then
  for base in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android \
    /Users/yanqing/Downloads/tennis-ai-signed-release/android
  do
    if [[ -f "$base/zhangqiu-release.jks" ]]; then
      cp -f "$base/zhangqiu-release.jks" "$ANDROID/zhangqiu-release.jks"
      break
    fi
  done
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
versionName=$VERSION_NAME
versionCode=$VERSION_CODE
applicationId=app.zhangqiu
built=$(date -u +%Y-%m-%dT%H:%M:%SZ)
signing=ZHANGQIU assembleRelease (no zip-inject)
feature=video-clip-duration
EOF
echo "APK ready $OUT_DIR/tennis-ai.apk"
