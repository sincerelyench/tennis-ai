#!/usr/bin/env bash
# Apply analyze trim/upload hotfix on the yqchen.blog Next host.
# Run on Mac with Keychain voice-diary-prod-ssh (or SSHPASS set).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
export SSHPASS="${SSHPASS:-$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)}"
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS / keychain $KEYCHAIN_SERVICE missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_OPT=/opt/tennis-ai
REMOTE_NGINX=/etc/nginx/snippets/yqchen-tai.conf

echo "== backup =="
"${SSH[@]}" "$WEB_HOST" "cp -a $REMOTE_OPT/lib/trim-file.ts $REMOTE_OPT/lib/trim-file.ts.bak-trim-$STAMP && cp -a $REMOTE_OPT/lib/tai.ts $REMOTE_OPT/lib/tai.ts.bak-trim-$STAMP && cp -a $REMOTE_OPT/components/analysis-view.tsx $REMOTE_OPT/components/analysis-view.tsx.bak-trim-$STAMP && cp -a $REMOTE_NGINX $REMOTE_NGINX.bak-trim-$STAMP"

echo "== upload patches =="
"${SCP[@]}" "$DIR/opt-patch/lib/trim-file.ts" "$WEB_HOST:$REMOTE_OPT/lib/trim-file.ts"
"${SCP[@]}" "$DIR/opt-patch/lib/tai.ts" "$WEB_HOST:$REMOTE_OPT/lib/tai.ts"
"${SCP[@]}" "$DIR/opt-patch/components/analysis-view.tsx" "$WEB_HOST:$REMOTE_OPT/components/analysis-view.tsx"
"${SCP[@]}" "$DIR/yqchen-tai.conf" "$WEB_HOST:$REMOTE_NGINX"

echo "== ownership =="
"${SSH[@]}" "$WEB_HOST" "chown tennis:tennis $REMOTE_OPT/lib/trim-file.ts $REMOTE_OPT/lib/tai.ts $REMOTE_OPT/components/analysis-view.tsx"

echo "== nginx test/reload =="
"${SSH[@]}" "$WEB_HOST" "nginx -t && systemctl reload nginx"

echo "== next build + restart =="
"${SSH[@]}" "$WEB_HOST" "sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"

echo "== probe =="
curl -sS -o /tmp/tai-health-after.json -w 'health:%{http_code}\n' https://yqchen.blog/tai/api/health
cat /tmp/tai-health-after.json
echo
"${SSH[@]}" "$WEB_HOST" "grep -Rola 'Submit only 10 seconds' /opt/tennis-ai/.next/static/chunks 2>/dev/null | head || echo OK_no_hard_20s_message; grep -Rola 'Trim again' /opt/tennis-ai/.next/static/chunks 2>/dev/null | head -3; grep -n proxy_request_buffering /etc/nginx/snippets/yqchen-tai.conf"

echo "DONE $STAMP"
