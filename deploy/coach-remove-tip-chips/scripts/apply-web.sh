#!/usr/bin/env bash
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

echo "== upload"
ssh_cmd "$WEB_HOST" "rm -rf /tmp/coach-remove-tip-chips && mkdir -p /tmp/coach-remove-tip-chips"
scp_cmd -r "$ROOT/opt-patch" "$ROOT/scripts" "$ROOT/preview" "$ROOT/mp-patch" "$WEB_HOST:/tmp/coach-remove-tip-chips/"
echo "== apply"
ssh_cmd "$WEB_HOST" "bash /tmp/coach-remove-tip-chips/scripts/apply-on-server.sh /opt/tennis-ai"
echo "Remote apply finished."
