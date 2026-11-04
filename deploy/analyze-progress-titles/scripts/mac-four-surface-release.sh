#!/usr/bin/env bash
# 涨球 · Mac four-surface release — analyze progress titles-only
# Run on Mac (Keychain voice-diary-prod-ssh + sshpass).
#
# 1) Apply Next + uni-app patches on 8.216.53.29:/opt/tennis-ai
# 2) Rebuild web; soft-patch IPA www; refresh mp-weixin.zip; APK left signed
# 3) Apply GPU /tai static index.html on 47.93.203.28
#
# Usage:
#   bash deploy/analyze-progress-titles/scripts/mac-four-surface-release.sh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REMOTE_TMP="/tmp/analyze-progress-titles"
GPU_ROOT="${GPU_ROOT:-/root/workspace/tennis-ai}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> [1/4] upload deploy package → $WEB_HOST:$REMOTE_TMP"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> [2/4] apply web + uni-app + rebuild Next/mp on web host"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> [3/4] apply GPU /tai static on $GPU_HOST"
"${SSH[@]}" "$GPU_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$GPU_HOST:$REMOTE_TMP/"
"${SSH[@]}" "$GPU_HOST" "bash '$REMOTE_TMP/scripts/apply-gpu.sh' '$GPU_ROOT'" || \
  echo "  · GPU apply skipped/failed (web titles-only still live)"

echo "==> [4/4] verify four public URLs"
for url in \
  "https://yqchen.blog/tennis" \
  "https://yqchen.blog/tennis/analyze-progress-preview.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "$url" || echo err)
  echo "  $code  $url"
done

echo
echo "Four-surface: Web Next rebuilt; APK/IPA WebView shells load /tennis; IPA www soft-scrubbed;"
echo "mp-weixin.zip refreshed when dist present; GPU /tai index titles-only when host reachable."
