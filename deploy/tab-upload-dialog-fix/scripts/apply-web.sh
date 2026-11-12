#!/usr/bin/env bash
# Apply tab-upload-dialog-fix on 8.216.53.29:/opt/tennis-ai
set -euo pipefail
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
OPT_ROOT="${OPT_ROOT:-/opt/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${OPT_ROOT}/.tab-upload-dialog-fix-backup-${STAMP}"

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
ssh_cmd "$WEB_HOST" "mkdir -p '$BACKUP/components' '$BACKUP/lib' && \
  cp -a '$OPT_ROOT/components/coach-video-upload.tsx' '$BACKUP/components/' && \
  cp -a '$OPT_ROOT/components/app-shell.tsx' '$BACKUP/components/' && \
  cp -a '$OPT_ROOT/lib/coach-active-job.ts' '$BACKUP/lib/' 2>/dev/null || true"

echo "== copy opt-patch"
scp_cmd "$ROOT/opt-patch/components/coach-video-upload.tsx" "$WEB_HOST:$OPT_ROOT/components/coach-video-upload.tsx"
scp_cmd "$ROOT/opt-patch/components/app-shell.tsx" "$WEB_HOST:$OPT_ROOT/components/app-shell.tsx"
scp_cmd "$ROOT/opt-patch/lib/coach-active-job.ts" "$WEB_HOST:$OPT_ROOT/lib/coach-active-job.ts"

echo "== build + restart (as tennis)"
ssh_cmd "$WEB_HOST" "chown tennis:tennis \
  '$OPT_ROOT/components/coach-video-upload.tsx' \
  '$OPT_ROOT/components/app-shell.tsx' \
  '$OPT_ROOT/lib/coach-active-job.ts' && \
  cd '$OPT_ROOT' && sudo -u tennis -H bash -lc 'npx next build --webpack' && \
  systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"
echo "Web apply done. backup=$BACKUP"
