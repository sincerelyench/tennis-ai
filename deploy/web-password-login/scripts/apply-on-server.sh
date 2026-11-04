#!/usr/bin/env bash
# Apply username/password login to yqchen.blog/tennis Next host.
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
REMOTE_BAK="$REMOTE_OPT/.web-password-login-backup-$STAMP"

echo "== backup =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_BAK' && cp -a \
  $REMOTE_OPT/lib/auth-store.ts \
  $REMOTE_OPT/app/api/auth/login/route.ts \
  $REMOTE_OPT/components/login-view.tsx \
  $REMOTE_OPT/lib/i18n/messages.ts \
  '$REMOTE_BAK/' && ls -la '$REMOTE_BAK'"

echo "== upload patches =="
"${SCP[@]}" "$DIR/opt-patch/lib/auth-store.ts" "$WEB_HOST:$REMOTE_OPT/lib/auth-store.ts"
"${SCP[@]}" "$DIR/opt-patch/app/api/auth/login/route.ts" "$WEB_HOST:$REMOTE_OPT/app/api/auth/login/route.ts"
"${SCP[@]}" "$DIR/opt-patch/components/login-view.tsx" "$WEB_HOST:$REMOTE_OPT/components/login-view.tsx"
"${SCP[@]}" "$DIR/opt-patch/lib/i18n/messages.ts" "$WEB_HOST:$REMOTE_OPT/lib/i18n/messages.ts"

echo "== ownership =="
"${SSH[@]}" "$WEB_HOST" "chown tennis:tennis \
  $REMOTE_OPT/lib/auth-store.ts \
  $REMOTE_OPT/app/api/auth/login/route.ts \
  $REMOTE_OPT/components/login-view.tsx \
  $REMOTE_OPT/lib/i18n/messages.ts"

echo "== next build + restart =="
"${SSH[@]}" "$WEB_HOST" "sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"

echo "== probe password login =="
curl -sS -X POST 'https://yqchen.blog/tennis/api/auth/login' \
  -H 'content-type: application/json' \
  -d '{"username":"zqdemo","password":"demo1234"}' \
  -c /tmp/tennis-pw-cookies.txt -w "\nHTTP %{http_code}\n" | tee /tmp/tennis-pw-login.json
curl -sS 'https://yqchen.blog/tennis/api/auth/session' -b /tmp/tennis-pw-cookies.txt -w "\nHTTP %{http_code}\n" | tee /tmp/tennis-pw-session.json

echo "DONE $STAMP backup=$REMOTE_BAK"
