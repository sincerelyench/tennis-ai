#!/usr/bin/env bash
# Apply signup + profile name/city onboarding to yqchen.blog/tennis Next host.
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
REMOTE_BAK="$REMOTE_OPT/.user-signup-onboarding-backup-$STAMP"

echo "== backup =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_BAK/app/api/auth' '$REMOTE_BAK/lib/i18n' '$REMOTE_BAK/components' && \
  cp -a $REMOTE_OPT/lib/auth-store.ts '$REMOTE_BAK/lib/' && \
  cp -a $REMOTE_OPT/lib/i18n/messages.ts '$REMOTE_BAK/lib/i18n/' && \
  cp -a $REMOTE_OPT/middleware.ts '$REMOTE_BAK/' && \
  cp -a $REMOTE_OPT/components/login-view.tsx $REMOTE_OPT/components/app-shell.tsx '$REMOTE_BAK/components/' && \
  cp -a $REMOTE_OPT/app/api/auth/login/route.ts '$REMOTE_BAK/app/api/auth/login-route.ts' && \
  cp -a $REMOTE_OPT/app/api/auth/session/route.ts '$REMOTE_BAK/app/api/auth/session-route.ts' && \
  ls -laR '$REMOTE_BAK'"

echo "== upload patches =="
"${SCP[@]}" "$DIR/opt-patch/lib/auth-store.ts" "$WEB_HOST:$REMOTE_OPT/lib/auth-store.ts"
"${SCP[@]}" "$DIR/opt-patch/lib/i18n/messages.ts" "$WEB_HOST:$REMOTE_OPT/lib/i18n/messages.ts"
"${SCP[@]}" "$DIR/opt-patch/middleware.ts" "$WEB_HOST:$REMOTE_OPT/middleware.ts"
"${SCP[@]}" "$DIR/opt-patch/components/login-view.tsx" "$WEB_HOST:$REMOTE_OPT/components/login-view.tsx"
"${SCP[@]}" "$DIR/opt-patch/components/app-shell.tsx" "$WEB_HOST:$REMOTE_OPT/components/app-shell.tsx"
"${SCP[@]}" "$DIR/opt-patch/components/profile-setup.tsx" "$WEB_HOST:$REMOTE_OPT/components/profile-setup.tsx"
"${SSH[@]}" "$WEB_HOST" "mkdir -p $REMOTE_OPT/app/api/auth/register"
"${SCP[@]}" "$DIR/opt-patch/app/api/auth/register/route.ts" "$WEB_HOST:$REMOTE_OPT/app/api/auth/register/route.ts"
"${SCP[@]}" "$DIR/opt-patch/app/api/auth/login/route.ts" "$WEB_HOST:$REMOTE_OPT/app/api/auth/login/route.ts"
"${SCP[@]}" "$DIR/opt-patch/app/api/auth/session/route.ts" "$WEB_HOST:$REMOTE_OPT/app/api/auth/session/route.ts"

echo "== ownership =="
"${SSH[@]}" "$WEB_HOST" "chown -R tennis:tennis \
  $REMOTE_OPT/lib/auth-store.ts \
  $REMOTE_OPT/lib/i18n/messages.ts \
  $REMOTE_OPT/middleware.ts \
  $REMOTE_OPT/components/login-view.tsx \
  $REMOTE_OPT/components/app-shell.tsx \
  $REMOTE_OPT/components/profile-setup.tsx \
  $REMOTE_OPT/app/api/auth/register \
  $REMOTE_OPT/app/api/auth/login/route.ts \
  $REMOTE_OPT/app/api/auth/session/route.ts"

echo "== next build + restart =="
"${SSH[@]}" "$WEB_HOST" "sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai && sleep 2 && systemctl is-active tennis-ai"

echo "== probe register =="
USER="zqsig$(date +%s | tail -c 6)"
PASS='demo1234'
curl -sS -X POST 'https://yqchen.blog/tennis/api/auth/register' \
  -H 'content-type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  -c /tmp/tennis-signup-cookies.txt -w "\nHTTP %{http_code}\n" | tee /tmp/tennis-signup-register.json
curl -sS -X PATCH 'https://yqchen.blog/tennis/api/auth/profile' \
  -H 'content-type: application/json' \
  -b /tmp/tennis-signup-cookies.txt \
  -d '{"displayName":"Signup Demo","cityId":"shanghai"}' \
  -w "\nHTTP %{http_code}\n" | tee /tmp/tennis-signup-profile.json
curl -sS 'https://yqchen.blog/tennis/api/auth/session' -b /tmp/tennis-signup-cookies.txt -w "\nHTTP %{http_code}\n" | tee /tmp/tennis-signup-session.json

echo "DONE $STAMP backup=$REMOTE_BAK user=$USER"
