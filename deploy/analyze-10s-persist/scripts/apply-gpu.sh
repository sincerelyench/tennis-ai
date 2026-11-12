#!/usr/bin/env bash
# Apply fast-path + persist GPU patches on 47.93.203.28
set -euo pipefail
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
GPU_ROOT="${GPU_ROOT:-/root/workspace/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${GPU_ROOT}/.analyze-10s-persist-backup-${STAMP}"

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

echo "== GPU backup ${BACKUP}"
ssh_cmd "$GPU_HOST" "mkdir -p '$BACKUP/web' '$BACKUP/pipeline' && \
  cp -a '$GPU_ROOT/web/app.py' '$BACKUP/web/' && \
  cp -a '$GPU_ROOT/pipeline/session.py' '$BACKUP/pipeline/' && \
  cp -a '$GPU_ROOT/pipeline/stroke.py' '$BACKUP/pipeline/' 2>/dev/null || true"

echo "== copy patches"
scp_cmd "$ROOT/gpu-patch/web/app.py" "$GPU_HOST:$GPU_ROOT/web/app.py"
scp_cmd "$ROOT/gpu-patch/pipeline/session.py" "$GPU_HOST:$GPU_ROOT/pipeline/session.py"
scp_cmd "$ROOT/gpu-patch/pipeline/stroke.py" "$GPU_HOST:$GPU_ROOT/pipeline/stroke.py"

echo "== syntax check + restart"
ssh_cmd "$GPU_HOST" "cd '$GPU_ROOT' && .venv/bin/python -m py_compile web/app.py pipeline/session.py pipeline/stroke.py && \
  systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai && \
  curl -sS http://127.0.0.1:27116/api/health"
echo "GPU apply done. backup=$BACKUP"
