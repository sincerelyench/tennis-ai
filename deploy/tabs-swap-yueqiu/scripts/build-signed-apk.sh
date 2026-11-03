#!/usr/bin/env bash
# Gradle assembleRelease + ZHANGQIU signing. Never zip-inject into a signed APK.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
WWW_SRC="$REPO_ROOT/deploy/tabs-swap-yueqiu/uniapp-www"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/tabs-swap-yueqiu/dist}"
VERSION_NAME="${VERSION_NAME:-1.0.97}"
VERSION_CODE="${VERSION_CODE:-197}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

# Prefer product www from prior release worktree if this clone lacks assets
if [[ ! -f "$ANDROID/app/src/main/assets/www/index.html" ]] || [[ ! -f "$ANDROID/app/src/main/assets/www/assets/index-SaS00-5Q.js" ]]; then
  for cand in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android/app/src/main/assets/www \
    /Users/yanqing/Downloads/tennis-ai-profile-location/android/app/src/main/assets/www \
    /Users/yanqing/Downloads/tennis-ai/android/app/src/main/assets/www
  do
    if [[ -f "$cand/index.html" ]]; then
      cp -a "$cand/." "$ANDROID/app/src/main/assets/www/"
      break
    fi
  done
fi

INJECTS=(
  zq-tabs-swap-yueqiu-inject.js
  zq-remove-profile-training-inject.js
  zq-remove-devices-inject.js
  zq-profile-city-inject.js
  zq-friends-city-inject.js
  zq-friends-score-inject.js
  zq-friends-matchmaking-inject.js
  zq-network-coach-inject.js
)
for f in "${INJECTS[@]}"; do
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
    "zq-friends-score-inject.js",
    "zq-profile-city-inject.js",
    "zq-remove-devices-inject.js",
    "zq-remove-profile-training-inject.js",
    "zq-network-coach-inject.js",
    "zq-tabs-swap-yueqiu-inject.js",
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

# Patch uni-app bundle: rename + swap player nav order
WWW_DIR="$ANDROID/app/src/main/assets/www" python3 - <<'PY'
from pathlib import Path
import os, re
www = Path(os.environ["WWW_DIR"])
patched = 0
old_nav = (
    '{key:"analysis",labelKey:"nav.analyze",url:"/pages/analysis/index",icon:"video"},'
    '{key:"coach",labelKey:"nav.coach",url:"/pages/coach/index",icon:"bot-message-square"},'
    '{key:"friends",labelKey:"nav.friends",url:"/pages/friends/index",icon:"users"},'
    '{key:"profile",labelKey:"nav.me",url:"/pages/profile/index",icon:"user"}'
)
new_nav = (
    '{key:"analysis",labelKey:"nav.analyze",url:"/pages/analysis/index",icon:"video"},'
    '{key:"friends",labelKey:"nav.friends",url:"/pages/friends/index",icon:"users"},'
    '{key:"coach",labelKey:"nav.coach",url:"/pages/coach/index",icon:"bot-message-square"},'
    '{key:"profile",labelKey:"nav.me",url:"/pages/profile/index",icon:"user"}'
)
seen = set()
for p in list(www.glob("assets/index-*.js")) + list(www.glob("**/index-*.js")):
    p = p.resolve()
    if p in seen:
        continue
    seen.add(p)
    t = p.read_text(encoding="utf-8", errors="ignore")
    orig = t
    if old_nav in t:
        t = t.replace(old_nav, new_nav)
    t = t.replace('friends:"球友"', 'friends:"约球"')
    t = t.replace('friends:"Friends"', 'friends:"Play"')
    t = re.sub(r'(friends:\{title:")球友(")', r'\1约球\2', t, count=1)
    t = re.sub(r'(friends:\{title:")Friends(")', r'\1Play\2', t, count=1)
    t = t.replace('titleText:"Friends"', 'titleText:"Play"')
    t = t.replace('titleText:"球友"', 'titleText:"约球"')
    if t != orig:
        p.write_text(t)
        patched += 1
        print("patched bundle", p.name)
print("bundle files patched:", patched)
PY

python3 - <<PY
from pathlib import Path
import re
p = Path("$ANDROID/app/build.gradle")
t = p.read_text()
t2 = re.sub(r"versionCode\s+\d+", "versionCode $VERSION_CODE", t, count=1)
t2 = re.sub(r'versionName\s+"[^"]+"', 'versionName "$VERSION_NAME"', t2, count=1)
# ensure product applicationId
if 'applicationId "app.zhangqiu"' not in t2 and 'applicationId "ai.tennis.train"' in t2:
    t2 = t2.replace('applicationId "ai.tennis.train"', 'applicationId "app.zhangqiu"', 1)
p.write_text(t2)
print("version -> $VERSION_NAME / $VERSION_CODE")
PY

if [[ ! -f "$ANDROID/keystore.properties" ]]; then
  for base in \
    /Users/yanqing/Downloads/tennis-ai/android \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android \
    /Users/yanqing/Downloads/tennis-ai-signed-release/android
  do
    [[ -f "$base/keystore.properties" ]] && cp -f "$base/keystore.properties" "$ANDROID/keystore.properties" && break
  done
fi
if [[ ! -f "$ANDROID/zhangqiu-release.jks" ]]; then
  for base in \
    /Users/yanqing/Downloads/tennis-ai/android \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/android \
    /Users/yanqing/Downloads/tennis-ai-signed-release/android
  do
    [[ -f "$base/zhangqiu-release.jks" ]] && cp -f "$base/zhangqiu-release.jks" "$ANDROID/zhangqiu-release.jks" && break
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
feature=tabs-swap-yueqiu
tabOrder=分析/约球/教练/我的 (EN: Analyze/Play/Coach/Me)
EOF
echo "APK ready: $OUT_DIR/tennis-ai.apk"
