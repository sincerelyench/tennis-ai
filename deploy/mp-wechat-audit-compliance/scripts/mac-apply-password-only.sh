#!/usr/bin/env bash
# Run ON Yanqing's Mac (has Keychain voice-diary-prod-ssh).
# Applies password-only login to prod H5 + mp-weixin.zip (all clients via WebView).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KIT="$ROOT/deploy/mp-wechat-audit-compliance"
HOST="${PROD_HOST:-8.216.53.29}"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "Need sshpass on Mac: brew install hudochenkov/sshpass/sshpass" >&2
  exit 1
fi
export SSHPASS="${SSHPASS:-$(security find-generic-password -s voice-diary-prod-ssh -w 2>/dev/null || true)}"
if [[ -z "${SSHPASS:-}" ]]; then
  echo "Missing Keychain item voice-diary-prod-ssh" >&2
  exit 1
fi

echo "==> Upload kit"
sshpass -e ssh -o StrictHostKeyChecking=accept-new "root@$HOST" 'rm -rf /tmp/mp-wechat-audit-compliance'
sshpass -e scp -r "$KIT" "root@$HOST:/tmp/mp-wechat-audit-compliance"
echo "==> Apply on server"
sshpass -e ssh "root@$HOST" 'bash /tmp/mp-wechat-audit-compliance/scripts/apply-on-server.sh /opt/tennis-ai'
echo "==> Verify live login has no modePhone"
sshpass -e ssh "root@$HOST" 'grep -R \"modePhone\" /opt/tennis-ai/components/login-view.tsx && exit 1 || echo LIVE_LOGIN_NO_MODEPHONE; cat /opt/tennis-ai/.next/BUILD_ID'
echo DONE
