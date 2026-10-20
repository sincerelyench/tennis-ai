#!/usr/bin/env bash
# Apply thin-repo GPU /tai changes (progress.py speeds on /result) to 47.93.203.28
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
GPU_ROOT="${GPU_ROOT:-/root/workspace/tennis-ai}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

echo "== GPU /tai: sync progress + e1/mp result UI =="
REMOTE_TMP="/tmp/report-four-dim-gpu-$$"
"${SSH[@]}" "$GPU_HOST" "mkdir -p '$REMOTE_TMP/web' '$REMOTE_TMP/i18n' '$REMOTE_TMP/miniprogram'"

"${SCP[@]}" \
  "$REPO_ROOT/web/progress.py" \
  "$GPU_HOST:$REMOTE_TMP/web/progress.py"
"${SCP[@]}" -r \
  "$REPO_ROOT/web/static/e1.js" \
  "$REPO_ROOT/web/static/e1.css" \
  "$GPU_HOST:$REMOTE_TMP/web/"
"${SCP[@]}" \
  "$REPO_ROOT/i18n/zh-CN.json" \
  "$REPO_ROOT/i18n/en.json" \
  "$GPU_HOST:$REMOTE_TMP/i18n/"
"${SCP[@]}" -r \
  "$REPO_ROOT/miniprogram/pages/result" \
  "$REPO_ROOT/miniprogram/i18n" \
  "$GPU_HOST:$REMOTE_TMP/miniprogram/"

"${SSH[@]}" "$GPU_HOST" "set -euo pipefail
  ROOT='$GPU_ROOT'
  PKG='$REMOTE_TMP'
  STAMP=\$(date +%Y%m%d-%H%M%S)
  BAK=\"\$ROOT/.report-four-dim-gpu-\$STAMP\"
  mkdir -p \"\$BAK/web/static\" \"\$BAK/i18n\" \"\$BAK/miniprogram\"
  [[ -f \$ROOT/web/progress.py ]] && cp -a \$ROOT/web/progress.py \"\$BAK/web/\"
  [[ -f \$ROOT/web/static/e1.js ]] && cp -a \$ROOT/web/static/e1.js \"\$BAK/web/static/\"
  [[ -f \$ROOT/web/static/e1.css ]] && cp -a \$ROOT/web/static/e1.css \"\$BAK/web/static/\"
  cp -a \"\$PKG/web/progress.py\" \"\$ROOT/web/progress.py\"
  cp -a \"\$PKG/web/e1.js\" \"\$ROOT/web/static/e1.js\"
  cp -a \"\$PKG/web/e1.css\" \"\$ROOT/web/static/e1.css\"
  cp -a \"\$PKG/i18n/\"*.json \"\$ROOT/i18n/\" 2>/dev/null || true
  if [[ -d \$ROOT/miniprogram ]]; then
    mkdir -p \$ROOT/miniprogram/pages \$ROOT/miniprogram/i18n
    cp -a \"\$PKG/miniprogram/result\" \"\$ROOT/miniprogram/pages/\"
    cp -a \"\$PKG/miniprogram/i18n/\"* \"\$ROOT/miniprogram/i18n/\" 2>/dev/null || true
  fi
  if [[ -x \$ROOT/deploy/pull.sh ]]; then
    bash \$ROOT/deploy/pull.sh || true
  fi
  systemctl restart tennis-ai 2>/dev/null || systemctl restart tennis-ai.service 2>/dev/null || true
  curl -fsS http://127.0.0.1:27116/api/health || curl -fsS http://127.0.0.1/tennis-ai/api/health || true
  echo GPU apply done
"
echo "GPU apply done"
