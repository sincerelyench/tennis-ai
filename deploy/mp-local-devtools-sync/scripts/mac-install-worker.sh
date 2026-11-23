#!/usr/bin/env bash
# Run ON Yanqing's Mac — installs Cursor CLI and starts My Machines worker.
# Cloud Linux cannot run this against your Mac disk.
set -euo pipefail

echo "==> 1) Install Cursor CLI"
curl https://cursor.com/install -fsS | bash

# Ensure PATH for this shell
export PATH="$HOME/.local/bin:$PATH"
hash -r 2>/dev/null || true

if ! command -v agent >/dev/null 2>&1; then
  echo "ERROR: 'agent' not on PATH. Add to ~/.zshrc:"
  echo '  export PATH="$HOME/.local/bin:$PATH"'
  exit 1
fi

echo "==> agent version: $(agent --version)"

echo "==> 2) Login (browser will open — use the SAME Cursor account as cloud agents)"
agent login

REPO_DIR="${WORKER_DIR:-$HOME/Downloads/mp-weixin (2)}"
# Prefer tennis-ai checkout if present
for c in \
  "$HOME/repos/tennis-ai" \
  "$HOME/code/tennis-ai" \
  "$HOME/Developer/tennis-ai" \
  "$HOME/Downloads/tennis-ai"
do
  if [[ -d "$c/.git" ]]; then REPO_DIR="$c"; break; fi
done

NAME="${WORKER_NAME:-yanqing-mac}"
echo "==> 3) Start worker (keep this terminal open)"
echo "    name=$NAME"
echo "    worker-dir=$REPO_DIR"
echo "    docs: https://cursor.com/docs/cloud-agent/self-hosted/my-machines"
echo ""

# tennis-ai remote helps routing; mp-weixin folder may not be a git repo — still OK for file writes via worker-dir of tennis-ai
if [[ -d "$REPO_DIR/.git" ]]; then
  exec agent worker start --name "$NAME" --worker-dir "$REPO_DIR"
else
  echo "NOTE: $REPO_DIR is not a git checkout; starting worker without --worker-dir"
  echo "      For tennis-ai tasks, clone the repo and re-run with WORKER_DIR=/path/to/tennis-ai"
  exec agent worker start --name "$NAME"
fi
