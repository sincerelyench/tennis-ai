#!/usr/bin/env bash
# Apply hide-empty-video-guidance on 8.216.53.29:/opt/tennis-ai
set -euo pipefail
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
OPT_ROOT="${OPT_ROOT:-/opt/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${OPT_ROOT}/.hide-empty-video-guidance-backup-${STAMP}"

ssh_cmd() {
  if [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no "$@"
  else
    ssh -o StrictHostKeyChecking=no "$@"
  fi
}
scp_cmd() {
  if [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no "$@"
  else
    scp -o StrictHostKeyChecking=no "$@"
  fi
}

echo "== web backup ${BACKUP}"
ssh_cmd "$WEB_HOST" "mkdir -p '$BACKUP/components' && \
  cp -a '$OPT_ROOT/components/coach-view.tsx' '$BACKUP/components/'"

echo "== copy opt-patch (coach-view only)"
scp_cmd "$ROOT/opt-patch/components/coach-view.tsx" "$WEB_HOST:$OPT_ROOT/components/coach-view.tsx"

echo "== build + restart (as tennis)"
ssh_cmd "$WEB_HOST" "chown tennis:tennis '$OPT_ROOT/components/coach-view.tsx' && \
  cd '$OPT_ROOT' && sudo -u tennis -H bash -lc 'npx next build --webpack' && \
  systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"
echo "Web apply done. backup=$BACKUP"
