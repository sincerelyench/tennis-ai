#!/usr/bin/env bash
# Ship coach-specialty-input-layout to root@8.216.53.29:/opt/tennis-ai
set -euo pipefail
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ssh_cmd() {
  if [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new "$@"
  fi
}
scp_cmd() {
  if [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no "$@"
  else
    scp -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "== upload patch tree"
ssh_cmd "$WEB_HOST" "rm -rf /tmp/coach-specialty-input-layout && mkdir -p /tmp/coach-specialty-input-layout"
scp_cmd -r "$ROOT/opt-patch" "$ROOT/scripts" "$ROOT/preview" "$ROOT/mp-patch" "$WEB_HOST:/tmp/coach-specialty-input-layout/"

echo "== apply on server"
ssh_cmd "$WEB_HOST" "bash /tmp/coach-specialty-input-layout/scripts/apply-on-server.sh /opt/tennis-ai"
echo "Remote apply finished."
