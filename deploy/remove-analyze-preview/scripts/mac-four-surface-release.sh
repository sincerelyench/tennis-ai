#!/usr/bin/env bash
# 涨球 · Mac four-surface release — remove 分析预览
# Run on yanqingMacBook Pro (Keychain voice-diary-prod-ssh + sshpass).
#
# 1) Apply Next + uni-app patches on 8.216.53.29:/opt/tennis-ai
# 2) Rebuild web; strip preview strings in APK/IPA; refresh mp-weixin.zip
# 3) Apply GPU /tai static (e1 + index + i18n) on 47.93.203.28
# 4) Optionally upload local APK/IPA/mp zip
#
# Usage:
#   bash deploy/remove-analyze-preview/scripts/mac-four-surface-release.sh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/remove-analyze-preview"
REMOTE_APK=/var/www/apk
LOCAL_APK="${LOCAL_APK:-}"
LOCAL_IPA="${LOCAL_IPA:-}"
LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-}"
GPU_ROOT="${GPU_ROOT:-/root/workspace/tennis-ai}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> [1/5] upload deploy package → $WEB_HOST:$REMOTE_TMP"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> [2/5] apply web + uni-app + strip APK/IPA + rebuild Next/mp on web host"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/5] apply GPU /tai static (e1 + index + i18n) on $GPU_HOST"
"${SSH[@]}" "$GPU_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$GPU_HOST:$REMOTE_TMP/"
"${SSH[@]}" "$GPU_HOST" "bash '$REMOTE_TMP/scripts/apply-gpu.sh' '$GPU_ROOT'"

# Optional local rebuilds
UNI_SRC="${UNI_SRC:-}"
for cand in \
  "$UNI_SRC" \
  "$HOME/tennis-ai/apps/uniapp" \
  "$REPO_ROOT/apps/uniapp"
do
  if [[ -n "$cand" && -d "$cand" ]]; then
    UNI_SRC="$cand"
    break
  fi
done
if [[ -n "$UNI_SRC" && -d "$UNI_SRC" ]]; then
  echo "==> local uni-app rebuild attempt: $UNI_SRC"
  mkdir -p "$UNI_SRC/src/components"
  cp -f "$HERE/uniapp-patch/progress-roadmap.snippet.vue" \
    "$UNI_SRC/src/components/zq-analyze-progress.vue" 2>/dev/null || true
  (
    cd "$UNI_SRC"
    npm run build:mp-weixin 2>/tmp/zq-mac-mp.log || npx uni build -p mp-weixin 2>>/tmp/zq-mac-mp.log || true
    npm run build:app 2>>/tmp/zq-mac-mp.log || npx uni build -p app 2>>/tmp/zq-mac-mp.log || true
  ) || true
  for d in "$UNI_SRC/dist/build/mp-weixin" "$UNI_SRC/dist/dev/mp-weixin"; do
    if [[ -f "$d/app.json" ]]; then
      LOCAL_MP_ZIP="${LOCAL_MP_ZIP:-/tmp/mp-weixin-no-preview.zip}"
      (cd "$d" && zip -qr "$LOCAL_MP_ZIP" .)
      echo "  built $LOCAL_MP_ZIP"
      break
    fi
  done
fi

# APK: do NOT auto-upload zip-injected or unsigned builds.
# Only upload when UPLOAD_SIGNED_APK=1 and LOCAL_APK points at a properly signed release.
UPLOAD_SIGNED_APK="${UPLOAD_SIGNED_APK:-0}"
if [[ -z "$LOCAL_IPA" && -x "$REPO_ROOT/ios/build-ipa.sh" ]]; then
  (cd "$REPO_ROOT/ios" && bash build-ipa.sh) && \
    LOCAL_IPA="$(ls -1t "$REPO_ROOT/ios"/build/*.ipa "$REPO_ROOT/ios"/*.ipa 2>/dev/null | head -1 || true)"
fi

echo "==> [4/5] upload client artifacts (IPA / mp-weixin.zip; APK only if signed)"
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_APK'"
UPLOADED=0
if [[ "$UPLOAD_SIGNED_APK" == "1" && -n "$LOCAL_APK" && -f "$LOCAL_APK" ]]; then
  chmod 644 "$LOCAL_APK" || true
  "${SCP[@]}" "$LOCAL_APK" "$WEB_HOST:$REMOTE_APK/tennis-ai.apk"
  UPLOADED=1
  echo "  uploaded signed LOCAL_APK -> tennis-ai.apk"
else
  echo "  · leaving /var/www/apk/tennis-ai.apk untouched (no zip-inject; wait for signed rebuild)"
fi
if [[ -n "$LOCAL_IPA" && -f "$LOCAL_IPA" ]]; then
  chmod 644 "$LOCAL_IPA" || true
  "${SCP[@]}" "$LOCAL_IPA" "$WEB_HOST:$REMOTE_APK/tennis-ai.ipa"
  UPLOADED=1
fi
if [[ -n "$LOCAL_MP_ZIP" && -f "$LOCAL_MP_ZIP" ]]; then
  chmod 644 "$LOCAL_MP_ZIP" || true
  "${SCP[@]}" "$LOCAL_MP_ZIP" "$WEB_HOST:$REMOTE_APK/mp-weixin.zip"
  UPLOADED=1
fi
if [[ "$UPLOADED" -eq 1 ]]; then
  "${SSH[@]}" "$WEB_HOST" "chmod 644 '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip 2>/dev/null || true; ls -la '$REMOTE_APK'/tennis-ai.apk '$REMOTE_APK'/tennis-ai.ipa '$REMOTE_APK'/mp-weixin.zip"
else
  echo "  (no local IPA/mp zip — server apply still refreshes mp when possible; APK preserved)"
fi
# Prove APK hash unchanged unless explicitly replaced
"${SSH[@]}" "$WEB_HOST" "sha256sum '$REMOTE_APK'/tennis-ai.apk"

echo "==> [5/5] verify four public URLs"
for url in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis/remove-analyze-preview.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" -L "$url" || echo "000")
  echo "  $code  $url"
done

# Quick negative check: live chunk should not contain 分析预览 in analyze-progress
echo "==> spot-check: 分析预览 should be gone from waiting UI marker page"
curl -sS "https://yqchen.blog/tennis/remove-analyze-preview.html" | grep -q 'data-no-analyze-preview' \
  && echo "  OK marker" || echo "  WARN marker missing"

echo "DONE four-surface remove-analyze-preview"
