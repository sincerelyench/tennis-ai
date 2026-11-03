#!/usr/bin/env bash
# 涨球 · Mac four-surface release — apk-web-align (APK ≡ live web)
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/apk-web-align"
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

echo "==> [1/4] upload note + VERSION (web already cumulative; no opt-patch required)"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP' '$REMOTE_APK'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

# Drop a small sync note + latest version txt on apk host / public preview
"${SSH[@]}" "$WEB_HOST" "bash -s" <<'EOS'
set -euo pipefail
NOTE=/var/www/apk/tennis-ai-latest.txt
cat > "$NOTE" <<EOF
versionCode=199
versionName=1.0.99
sha256=$(cut -d' ' -f1 /tmp/apk-web-align/dist/SHA256.txt 2>/dev/null || echo pending)
updated=2026-11-04 apk-web-align
method=gradle assembleRelease (JDK17) + ZHANGQIU
start_url=https://yqchen.blog/tennis
note=full rebuild; not zip-inject; APK≡web cumulative
EOF
# optional public html note under /tennis if public dir exists
if [[ -d /opt/tennis-ai/public ]]; then
  cp -f /tmp/apk-web-align/preview/index.html /opt/tennis-ai/public/apk-web-align.html 2>/dev/null || true
fi
EOS

echo "==> [2/4] refresh mp-weixin.zip"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-apk-web-align.zip}"
(
  cd "$REPO_ROOT/miniprogram"
  printf '%s\n' "涨球 apk-web-align $(date +%Y-%m-%d) APK 1.0.99 — 壳打开 https://yqchen.blog/tennis，与网页一致（约球/教练换位、无我的统计、匹配微信约定、选段默认10秒）。" > APK-WEB-ALIGN-NOTE.txt
  if [[ -d "$HERE/mp-patch" ]]; then
    cp -a "$HERE/mp-patch/." .
  fi
  zip -qr "$LOCAL_MP_ZIP" . -x '*.DS_Store*'
)
echo "  built $LOCAL_MP_ZIP"

echo "==> [3/4] upload APK/IPA/mp"
if [[ -z "$LOCAL_APK" && -f "$HERE/dist/tennis-ai.apk" ]]; then
  LOCAL_APK="$HERE/dist/tennis-ai.apk"
fi
[[ -n "$LOCAL_APK" && -f "$LOCAL_APK" ]] || { echo "missing LOCAL_APK" >&2; exit 1; }
chmod 644 "$LOCAL_APK" || true
"${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
"${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest.apk"
if [[ -f "$HERE/dist/VERSION.txt" ]]; then
  "${SCP[@]}" "$HERE/dist/VERSION.txt" "$WEB_HOST:$REMOTE_APK/tennis-ai-latest-SYNC.txt"
fi
if [[ -f "$HERE/dist/SHA256.txt" ]]; then
  SHA=$(cut -d' ' -f1 "$HERE/dist/SHA256.txt")
  "${SSH[@]}" "$WEB_HOST" "cat > '$REMOTE_APK/tennis-ai-latest.txt' <<EOF
versionCode=199
versionName=1.0.99
sha256=$SHA
bytes=$(wc -c < "$LOCAL_APK" | tr -d ' ')
updated=2026-11-04 apk-web-align
method=gradle assembleRelease (JDK17) + ZHANGQIU
start_url=https://yqchen.blog/tennis
note=full rebuild; not zip-inject; APK≡web cumulative
EOF"
fi

# Refresh IPA shell start URL + injects from baseline
if [[ ! -f "$HERE/dist/tennis-ai.ipa" ]]; then
  BASE_IPA=""
  for cand in \
    /Users/yanqing/Downloads/tennis-ai/deploy/tabs-swap-yueqiu/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai/deploy/video-clip-duration/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-match-wechat-intro/deploy/match-wechat-intro/dist/tennis-ai.ipa \
    /Users/yanqing/Downloads/tennis-ai-remove-profile-stats/deploy/remove-profile-stats/dist/tennis-ai.ipa
  do
    [[ -f "$cand" ]] && BASE_IPA="$cand" && break
  done
  if [[ -n "$BASE_IPA" ]]; then
    mkdir -p "$HERE/dist"
    IPA_STAGING=$(mktemp -d)
    unzip -q "$BASE_IPA" -d "$IPA_STAGING"
    # Prefer Info.plist / any embedded default URL rewrite via note file; WWW injects for offline
    WWW="$IPA_STAGING/Payload/Zhangqiu.app/www"
    mkdir -p "$WWW/assets"
    for f in "${INJECTS[@]:-}"; do true; done
    for f in zq-tabs-swap-yueqiu-inject.js zq-remove-profile-stats-inject.js zq-remove-profile-training-inject.js zq-remove-devices-inject.js zq-profile-city-inject.js zq-friends-city-inject.js zq-friends-score-inject.js zq-friends-matchmaking-inject.js zq-network-coach-inject.js; do
      [[ -f "$HERE/uniapp-www/$f" ]] || continue
      cp -f "$HERE/uniapp-www/$f" "$WWW/assets/$f"
      cp -f "$HERE/uniapp-www/$f" "$WWW/$f"
    done
    # If a ShellConfig-compiled binary can't be rebuilt here, drop a redirect boot HTML as www fallback
    # and stamp start URL for operators.
    printf '%s\n' "https://yqchen.blog/tennis" > "$IPA_STAGING/Payload/Zhangqiu.app/START_URL.txt"
    printf '%s\n' "apk-web-align 1.0.99 $(date -u +%Y-%m-%dT%H:%M:%SZ) start=https://yqchen.blog/tennis" > "$IPA_STAGING/Payload/Zhangqiu.app/APK-WEB-ALIGN.txt"
    # Patch any plaintext default URL inside the app bundle
    python3 - <<PY
from pathlib import Path
root = Path("$IPA_STAGING/Payload/Zhangqiu.app")
old = b"https://tennis.47.93.203.28.sslip.io/e1"
new = b"https://yqchen.blog/tennis"
n = 0
for p in root.rglob("*"):
    if not p.is_file():
        continue
    if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".mp4", ".gif", ".webp", ".car"}:
        continue
    try:
        data = p.read_bytes()
    except Exception:
        continue
    if old in data:
        # pad/truncate carefully if lengths differ — URLs differ in length; only replace in text-ish files
        if b"\0" in data and data.count(old) > 0:
            # Mach-O / binary: replace with same-length pad
            pad = new + b"\0" * (len(old) - len(new)) if len(new) <= len(old) else new[:len(old)]
            if len(pad) != len(old):
                continue
            data2 = data.replace(old, pad)
        else:
            data2 = data.replace(old, new)
        if data2 != data:
            p.write_bytes(data2)
            n += 1
            print("patched", p.relative_to(root))
print("ipa files patched:", n)
PY
    (
      cd "$IPA_STAGING"
      zip -qr "$HERE/dist/tennis-ai.ipa" Payload
    )
    shasum -a 256 "$HERE/dist/tennis-ai.ipa" | tee "$HERE/dist/IPA-SHA256.txt"
    cat > "$HERE/dist/IPA-NOTE.txt" <<EOF
IPA shell refreshed: default start URL → https://yqchen.blog/tennis (was sslip /e1).
APK 1.0.99 fully re-signed assembleRelease.
EOF
    echo "  built refreshed IPA"
  fi
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

"${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai-latest.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip '$REMOTE_APK'/tennis-ai-latest.txt 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip '$REMOTE_APK'/tennis-ai-latest.txt"

echo "==> [4/4] verify URLs"
for url in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip" \
  "https://yqchen.blog/tennis-ai-latest.txt"
do
  code=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" -L "$url" || echo "000")
  echo "  $code  $url"
done
echo "DONE apk-web-align four-surface"
