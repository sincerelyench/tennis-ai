#!/usr/bin/env bash
# Full release APK resign for correct-video-by-issues (涨球). Never zip-inject.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ANDROID="$REPO_ROOT/android"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WWW_SRC="$HERE/uniapp-www"
OUT_DIR="${OUT_DIR:-$HERE/dist}"
VERSION_NAME="${VERSION_NAME:-1.0.100}"
VERSION_CODE="${VERSION_CODE:-200}"
START_URL="${ZQ_START_URL:-https://yqchen.blog/tennis}"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME VERSION=$VERSION_NAME/$VERSION_CODE START_URL=$START_URL"
mkdir -p "$ANDROID/app/src/main/assets/www/assets" "$OUT_DIR"

# Seed www if thin
if [[ ! -f "$ANDROID/app/src/main/assets/www/index.html" ]]; then
  for cand in \
    "$REPO_ROOT/android/app/src/main/assets/www" \
    /Users/yanqing/Downloads/tennis-ai/android/app/src/main/assets/www \
    /Users/yanqing/Downloads/tennis-ai-ship/android/app/src/main/assets/www
  do
    if [[ -f "$cand/index.html" ]]; then
      cp -a "$cand/." "$ANDROID/app/src/main/assets/www/"
      break
    fi
  done
fi

INJECT="zq-correct-by-issues-inject.js"
cp -f "$WWW_SRC/$INJECT" "$ANDROID/app/src/main/assets/www/assets/$INJECT"
cp -f "$WWW_SRC/$INJECT" "$ANDROID/app/src/main/assets/www/$INJECT"

# Carry forward prior injects if present in apk-web-align kit
PRIOR="$REPO_ROOT/deploy/apk-web-align/uniapp-www"
for f in \
  zq-tabs-swap-yueqiu-inject.js \
  zq-remove-profile-stats-inject.js \
  zq-remove-profile-training-inject.js \
  zq-remove-devices-inject.js \
  zq-profile-city-inject.js \
  zq-friends-city-inject.js \
  zq-friends-score-inject.js \
  zq-friends-matchmaking-inject.js \
  zq-network-coach-inject.js \
  zq-four-dim-inject.js
do
  if [[ -f "$PRIOR/$f" ]]; then
    cp -f "$PRIOR/$f" "$ANDROID/app/src/main/assets/www/assets/$f"
    cp -f "$PRIOR/$f" "$ANDROID/app/src/main/assets/www/$f"
  elif [[ -f "$ANDROID/app/src/main/assets/www/assets/$f" ]]; then
    :
  fi
done

python3 - <<PY
from pathlib import Path
html = Path("$ANDROID/app/src/main/assets/www/index.html")
t = html.read_text(encoding="utf-8") if html.exists() else ""
names = [
    "zq-four-dim-inject.js",
    "zq-friends-city-inject.js",
    "zq-friends-matchmaking-inject.js",
    "zq-friends-score-inject.js",
    "zq-profile-city-inject.js",
    "zq-remove-devices-inject.js",
    "zq-remove-profile-training-inject.js",
    "zq-remove-profile-stats-inject.js",
    "zq-network-coach-inject.js",
    "zq-tabs-swap-yueqiu-inject.js",
    "zq-correct-by-issues-inject.js",
]
changed = False
for name in names:
    if name in t:
        continue
    if "</body>" in t:
        t = t.replace("</body>", f'  <script src="./assets/{name}"></script>\n</body>')
        changed = True
if changed and html.exists():
    html.write_text(t, encoding="utf-8")
print("index wired", changed)
PY

# Bump version in build.gradle
python3 - <<PY
from pathlib import Path
import re
p = Path("$ANDROID/app/build.gradle")
t = p.read_text(encoding="utf-8")
t2 = re.sub(r"versionCode\s+\d+", "versionCode $VERSION_CODE", t, count=1)
t2 = re.sub(r'versionName\s+"[^"]+"', 'versionName "$VERSION_NAME"', t2, count=1)
p.write_text(t2, encoding="utf-8")
print("version bumped")
PY

cd "$ANDROID"
./gradlew assembleRelease -PZQ_START_URL="$START_URL" --no-daemon
APK_OUT=$(find "$ANDROID/app/build/outputs/apk/release" -name "*.apk" | head -1)
[[ -n "$APK_OUT" ]] || { echo "no apk" >&2; exit 1; }
cp -f "$APK_OUT" "$OUT_DIR/tennis-ai.apk"
chmod 644 "$OUT_DIR/tennis-ai.apk"
ls -la "$OUT_DIR/tennis-ai.apk"
echo "APK ready $VERSION_NAME ($VERSION_CODE)"
