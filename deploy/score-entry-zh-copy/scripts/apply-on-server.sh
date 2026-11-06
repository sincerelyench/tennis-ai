#!/usr/bin/env bash
# Apply Chinese-only score-entry copy (no EN fallback / Latin A-B / UTR mix) to yqchen.blog/tennis.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
export SSHPASS="${SSHPASS:-Hello2026}"

command -v sshpass >/dev/null || { echo "sshpass not found (use paramiko apply if needed)" >&2; exit 1; }
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_OPT=/opt/tennis-ai
REMOTE_BAK="$REMOTE_OPT/.score-entry-zh-copy-backup-$STAMP"

echo "== backup =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_BAK/lib/i18n' '$REMOTE_BAK/public/assets' && \
  cp -a $REMOTE_OPT/lib/i18n/messages.ts '$REMOTE_BAK/lib/i18n/' && \
  cp -a $REMOTE_OPT/public/zq-friends-score-inject.js '$REMOTE_BAK/public/' 2>/dev/null || true && \
  cp -a $REMOTE_OPT/public/assets/zq-friends-score-inject.js '$REMOTE_BAK/public/assets/' 2>/dev/null || true && \
  ls -laR '$REMOTE_BAK'"

echo "== upload patches =="
"${SCP[@]}" "$DIR/opt-patch/lib/i18n/messages.ts" "$WEB_HOST:$REMOTE_OPT/lib/i18n/messages.ts"
"${SCP[@]}" "$DIR/opt-patch/public/zq-friends-score-inject.js" "$WEB_HOST:$REMOTE_OPT/public/zq-friends-score-inject.js"
"${SCP[@]}" "$DIR/opt-patch/public/assets/zq-friends-score-inject.js" "$WEB_HOST:$REMOTE_OPT/public/assets/zq-friends-score-inject.js"

echo "== ownership =="
"${SSH[@]}" "$WEB_HOST" "chown -R tennis:tennis \
  $REMOTE_OPT/lib/i18n/messages.ts \
  $REMOTE_OPT/public/zq-friends-score-inject.js \
  $REMOTE_OPT/public/assets/zq-friends-score-inject.js"

echo "== next build + restart =="
"${SSH[@]}" "$WEB_HOST" "sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"

echo "DONE $STAMP backup=$REMOTE_BAK"
