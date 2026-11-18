#!/usr/bin/env bash
# Run on Yanqing's Mac (Keychain service voice-diary-prod-ssh).
# Uploads kit and runs apply-on-server.sh on 8.216.53.29.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${PROD_HOST:-root@8.216.53.29}"
PASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
export SSHPASS="$PASS"
sshpass -e scp -o StrictHostKeyChecking=accept-new -r \
  "$ROOT" "$HOST:/tmp/wechat-subscribe-notify"
sshpass -e ssh -o StrictHostKeyChecking=accept-new "$HOST" \
  "bash /tmp/wechat-subscribe-notify/scripts/apply-on-server.sh /opt/tennis-ai"
echo "Applied. Reminder: set WECHAT_MP_TMPL_* after 公众平台 templates exist."
