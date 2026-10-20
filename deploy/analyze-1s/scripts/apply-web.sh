#!/usr/bin/env bash
# Apply Next/web + uni-app poll/ETA patches on 8.216 (/opt/tennis-ai).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

PKG="$(cd "$(dirname "$0")/.." && pwd)"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
OPT_ROOT="${OPT_ROOT:-/opt/tennis-ai}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"

if [[ -z "${SSHPASS:-}" ]]; then
  SSHPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
  export SSHPASS
fi
[[ -n "${SSHPASS:-}" ]] || { echo "missing Keychain password for $KEYCHAIN_SERVICE" >&2; exit 1; }
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -r -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

REMOTE_TMP="/tmp/analyze-1s-web-$$"
echo "== upload package =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" "$PKG/opt-patch" "$PKG/uniapp-patch" "$WEB_HOST:$REMOTE_TMP/"

"${SSH[@]}" "$WEB_HOST" "set -euo pipefail
  ROOT='$OPT_ROOT'
  PKG='$REMOTE_TMP'
  STAMP=\$(date +%Y%m%d-%H%M%S)
  BAK=\"\$ROOT/.analyze-1s-web-backup-\$STAMP\"
  mkdir -p \"\$BAK\"

  LIB=\"\"
  for d in \"\$ROOT/lib\" \"\$ROOT/apps/web/lib\" \"\$ROOT/src/lib\"; do
    [[ -d \"\$d\" ]] && LIB=\"\$d\" && break
  done
  if [[ -n \"\$LIB\" ]]; then
    if [[ -f \"\$LIB/job-progress.ts\" ]]; then
      mkdir -p \"\$BAK/lib\"
      cp -a \"\$LIB/job-progress.ts\" \"\$BAK/lib/\"
    fi
    cp -a \"\$PKG/opt-patch/lib/job-progress.ts\" \"\$LIB/job-progress.ts\"
    echo wrote \$LIB/job-progress.ts
  else
    echo 'WARN: no lib/ dir for job-progress.ts'
  fi

  UNI=\"\"
  for d in \"\$ROOT/apps/uniapp\" \"\$ROOT/uniapp\" \"\$ROOT/apps/tennis-uniapp\"; do
    [[ -d \"\$d\" ]] && UNI=\"\$d\" && break
  done
  if [[ -n \"\$UNI\" ]]; then
    python3 \"\$PKG/uniapp-patch/patch-uniapp-poll.py\" \"\$UNI/src\" || python3 \"\$PKG/uniapp-patch/patch-uniapp-poll.py\" \"\$UNI\"
  else
    echo 'WARN: uniapp src not found — native rebuild may miss poll patch'
  fi

  if [[ -f \"\$ROOT/package.json\" ]]; then
    sudo -u tennis bash -lc \"cd '\$ROOT' && npm run build\"
    systemctl restart tennis-ai || true
  fi
  echo web apply done
"
echo "Web apply done"
