#!/usr/bin/env bash
# Apply UTR / level "?" help tips to yqchen.blog/tennis Next host.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
export SSHPASS="${SSHPASS:-Hello2026}"

command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_OPT=/opt/tennis-ai
REMOTE_BAK="$REMOTE_OPT/.utr-level-help-tips-backup-$STAMP"

echo "== backup =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_BAK/lib/i18n' '$REMOTE_BAK/components' && \
  cp -a $REMOTE_OPT/lib/i18n/messages.ts '$REMOTE_BAK/lib/i18n/' && \
  cp -a $REMOTE_OPT/components/friends-view.tsx '$REMOTE_BAK/components/' && \
  ls -laR '$REMOTE_BAK'"

echo "== upload patches =="
"${SCP[@]}" "$DIR/opt-patch/lib/i18n/messages.ts" "$WEB_HOST:$REMOTE_OPT/lib/i18n/messages.ts"
"${SCP[@]}" "$DIR/opt-patch/components/friends-view.tsx" "$WEB_HOST:$REMOTE_OPT/components/friends-view.tsx"
"${SCP[@]}" "$DIR/opt-patch/components/rating-help-tip.tsx" "$WEB_HOST:$REMOTE_OPT/components/rating-help-tip.tsx"

echo "== ownership =="
"${SSH[@]}" "$WEB_HOST" "chown -R tennis:tennis \
  $REMOTE_OPT/lib/i18n/messages.ts \
  $REMOTE_OPT/components/friends-view.tsx \
  $REMOTE_OPT/components/rating-help-tip.tsx"

echo "== next build + restart =="
"${SSH[@]}" "$WEB_HOST" "sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"

echo "== probe friends HTML =="
curl -sS -o /tmp/tennis-friends-probe.html -w "HTTP %{http_code}\n" 'https://yqchen.blog/tennis/friends' || true
grep -o 'data-help\|levelHelp\|utrHelp\|rating-help' /tmp/tennis-friends-probe.html | head || true

echo "DONE $STAMP backup=$REMOTE_BAK"
