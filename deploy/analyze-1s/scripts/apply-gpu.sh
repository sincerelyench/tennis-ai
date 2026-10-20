#!/usr/bin/env bash
# Apply ≤1s analyze fast path onto GPU /tai host.
# Run on yanqing Mac: Keychain voice-diary-prod-ssh + sshpass.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
GPU_ROOT="${GPU_ROOT:-/root/workspace/tennis-ai}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

FILES=(
  web/app.py
  web/static/index.html
  web/static/e1.js
  web/static/e1.css
  pipeline/session.py
  pipeline/stroke.py
  pipeline/oss.py
  pipeline/analyze.py
  pipeline/coach.py
  pipeline/technique.py
  web/progress.py
  i18n/zh-CN.json
  i18n/en.json
)

echo "== GPU preflight =="
curl -sS https://yqchen.blog/tai/api/health | tee /tmp/tai-health-before-1s.json
echo

REMOTE_TMP="/tmp/analyze-1s-gpu-$$"
"${SSH[@]}" "$GPU_HOST" "mkdir -p '$REMOTE_TMP'/{web/static,pipeline,i18n,web}"
for f in "${FILES[@]}"; do
  [[ -f "$ROOT/$f" ]] || { echo "missing $ROOT/$f" >&2; exit 1; }
  "${SCP[@]}" "$ROOT/$f" "$GPU_HOST:$REMOTE_TMP/$f"
done

"${SSH[@]}" "$GPU_HOST" "set -euo pipefail
  OPT='$GPU_ROOT'
  STAMP=\$(date +%Y%m%d-%H%M%S)
  BAK=\"\$OPT/.analyze-1s-backup-\$STAMP\"
  mkdir -p \"\$BAK\"
  for f in web/app.py web/static/index.html web/static/e1.js web/static/e1.css \\
           pipeline/session.py pipeline/stroke.py pipeline/oss.py pipeline/analyze.py \\
           pipeline/coach.py pipeline/technique.py web/progress.py i18n/zh-CN.json i18n/en.json; do
    if [[ -f \"\$OPT/\$f\" ]]; then
      mkdir -p \"\$BAK/\$(dirname \"\$f\")\"
      cp -a \"\$OPT/\$f\" \"\$BAK/\$f\"
    fi
    mkdir -p \"\$OPT/\$(dirname \"\$f\")\"
    cp -a '$REMOTE_TMP'/\$f \"\$OPT/\$f\"
    echo wrote \$f
  done
  python3 -m py_compile \"\$OPT/web/app.py\" \"\$OPT/pipeline/session.py\" \"\$OPT/pipeline/stroke.py\"
  systemctl restart tennis-ai-api 2>/dev/null \\
    || systemctl restart tennis-ai 2>/dev/null \\
    || systemctl restart uvicorn 2>/dev/null \\
    || echo 'WARN: restart unit manually'
  sleep 2
  curl -sS http://127.0.0.1:27116/api/health || true
"
echo
echo "== public health =="
curl -sS https://yqchen.blog/tai/api/health
echo
echo "GPU apply done"
