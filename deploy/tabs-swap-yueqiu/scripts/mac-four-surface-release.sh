#!/usr/bin/env bash
# 涨球 · Mac four-surface release — tabs-swap-yueqiu
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/tabs-swap-yueqiu"
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

echo "==> [1/5] upload deploy package"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> [2/5] apply Next web patches"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] refresh mp-weixin.zip"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-tabs-swap-yueqiu.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 tabs-swap-yueqiu $(date +%Y-%m-%d) APK 1.0.97 — 底栏：分析 / 约球 / 教练 / 我的（EN Play）。" > TABS-SWAP-YUEQIU-NOTE.txt
  if [[ -d "$HERE/mp-patch" ]]; then
    cp -a "$HERE/mp-patch/." .
  fi
  zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
)
echo "  built $LOCAL_MP_ZIP"

echo "==> [4/5] upload APK/IPA/mp when provided"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
if [[ -z "$LOCAL_APK" && -f "$HERE/dist/tennis-ai.apk" ]]; then
  LOCAL_APK="$HERE/dist/tennis-ai.apk"
fi
if [[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest.apk"
  echo "  uploaded signed APK"
else
  echo "  · APK not uploaded (set LOCAL_APK after assembleRelease)"
fi
if [[ -z "$LOCAL_IPA" && -f "$HERE/dist/tennis-ai.ipa" ]]; then
  LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
fi

if [[ -d "$REPO_ROOT/ios/Zhangqiu/www" ]]; then
  for f in zq-tabs-swap-yueqiu-inject.js zq-remove-profile-training-inject.js zq-remove-devices-inject.js zq-profile-city-inject.js zq-friends-city-inject.js zq-friends-score-inject.js zq-friends-matchmaking-inject.js zq-network-coach-inject.js; do
    [[ -f "$HERE/uniapp-www/$f" ]] || continue
    mkdir -p "$REPO_ROOT/ios/Zhangqiu/www/assets"
    cp -f "$HERE/uniapp-www/$f" "$REPO_ROOT/ios/Zhangqiu/www/assets/$f"
  done
  WWW_DIR="$REPO_ROOT/ios/Zhangqiu/www" python3 - <<'PY'
from pathlib import Path
import os
www = Path(os.environ["WWW_DIR"])
html = www / "index.html"
if html.exists():
    t = html.read_text()
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
    html.write_text(t)
    print("ios www wired")
# also patch ios www bundle if present
import re
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
for p in www.glob("assets/index-*.js"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    orig = t
    if old_nav in t:
        t = t.replace(old_nav, new_nav)
    t = t.replace('friends:"球友"', 'friends:"约球"').replace('friends:"Friends"', 'friends:"Play"')
    t = re.sub(r'(friends:\{title:")球友(")', r'\1约球\2', t, count=1)
    t = re.sub(r'(friends:\{title:")Friends(")', r'\1Play\2', t, count=1)
    if t != orig:
        p.write_text(t)
        print("ios bundle patched", p.name)
PY
fi

# Refresh IPA from previous signed shell + injects
if [[ ! -f "$HERE/dist/tennis-ai.ipa" ]]; then
  BASE_IPA=""
  for cand in \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-training/deploy/remove-profile-training/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-profile-location/deploy/profile-change-location/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-friends-score-confirm/deploy/friends-score-confirm/dist/tennis-ai.ipa
  do
    [[ -f "$cand" ]] && BASE_IPA="$cand" && break
  done
  if [[ -n "$BASE_IPA" ]]; then
    mkdir -p "$HERE/dist"
    IPA_STAGING=$(mktemp -d)
    unzip -q "$BASE_IPA" -d "$IPA_STAGING"
    WWW="$IPA_STAGING/Payload/Zhangqiu.app/www"
    mkdir -p "$WWW/assets"
    for f in zq-tabs-swap-yueqiu-inject.js zq-remove-profile-training-inject.js zq-remove-devices-inject.js zq-profile-city-inject.js zq-friends-city-inject.js zq-friends-score-inject.js zq-friends-matchmaking-inject.js zq-network-coach-inject.js; do
      [[ -f "$HERE/uniapp-www/$f" ]] || continue
      cp -f "$HERE/uniapp-www/$f" "$WWW/assets/$f"
      cp -f "$HERE/uniapp-www/$f" "$WWW/$f"
    done
    WWW_DIR="$WWW" python3 - <<'PY'
from pathlib import Path
import os, re
www = Path(os.environ["WWW_DIR"])
html = www / "index.html"
if html.exists():
    t = html.read_text()
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
    html.write_text(t)
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
for p in www.glob("assets/index-*.js"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    orig = t
    if old_nav in t:
        t = t.replace(old_nav, new_nav)
    t = t.replace('friends:"球友"', 'friends:"约球"').replace('friends:"Friends"', 'friends:"Play"')
    t = re.sub(r'(friends:\{title:")球友(")', r'\1约球\2', t, count=1)
    t = re.sub(r'(friends:\{title:")Friends(")', r'\1Play\2', t, count=1)
    if t != orig:
        p.write_text(t)
PY
    printf '%s\n' "tabs-swap-yueqiu 1.0.97 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$IPA_STAGING/Payload/Zhangqiu.app/TABS-SWAP-YUEQIU.txt"
    (
      cd "$IPA_STAGING"
      zip -qr "$HERE/dist/tennis-ai.ipa" Payload
    )
    shasum -a 256 "$HERE/dist/tennis-ai.ipa" | tee "$HERE/dist/IPA-SHA256.txt"
    cat > "$HERE/dist/IPA-NOTE.txt" <<EOF
IPA WebView shell refreshed with tabs-swap-yueqiu inject (+ prior friends/coach/profile injects).
Tab order: 分析 / 约球 / 教练 / 我的 (EN Play).
APK 1.0.97 is fully re-signed assembleRelease.
EOF
    echo "  built refreshed IPA from baseline shell"
    if [[ -z "$LOCAL_IPA" ]]; then
      LOCAL_IPA="$HERE/dist/tennis-ai.ipa"
      chmod 644 "$LOCAL_IPA" || true
      "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
    fi
  fi
fi

"${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai-latest.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip"

echo "==> [5/5] verify URLs"
for url in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis/friends" \
  "https://yqchen.blog/tennis/coach" \
  "https://yqchen.blog/tennis/tabs-swap-yueqiu.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" -L "$url" || echo "000")
  echo "  $code  $url"
done
echo "DONE tabs-swap-yueqiu four-surface"
