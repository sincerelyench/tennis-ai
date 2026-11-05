#!/usr/bin/env bash
# Apply analyze-stuck-2pct hotfix to prod from Mac (Keychain) or any host with SSHPASS.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_TMP="/tmp/analyze-stuck-2pct"

if [[ -z "${SSHPASS:-}" ]]; then
  if command -v security >/dev/null 2>&1; then
    SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
    export SSHPASS
  elif [[ -f "${HOME}/.ssh/voice-diary-prod" ]]; then
    SSHPASS="$(tr -d '\n' < "${HOME}/.ssh/voice-diary-prod")"
    export SSHPASS
  fi
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing SSHPASS / Keychain $KEYCHAIN_SERVICE / ~/.ssh/voice-diary-prod" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "==> upload -> $WEB_HOST:$REMOTE_TMP"
"${SSH[@]}" "$WEB_HOST" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$HERE/." "$WEB_HOST:$REMOTE_TMP/"

echo "==> apply on server"
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> public probes"
curl -sS -o /tmp/tai-h.json -w "tai_health:%{http_code}\n" https://yqchen.blog/tai/api/health
# password login + HTML gate
curl -sS -c /tmp/zq-c.txt -H 'content-type: application/json' \
  -d '{"username":"zqdemo","password":"demo1234"}' \
  https://yqchen.blog/tennis/api/auth/login | tee /tmp/zq-login.json
echo
curl -sS -b /tmp/zq-c.txt -o /dev/null -w "analysis:%{http_code} %{redirect_url}\n" \
  https://yqchen.blog/tennis/analysis
