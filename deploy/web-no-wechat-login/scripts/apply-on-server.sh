#!/usr/bin/env bash
# Hide WeChat login on browser web; keep it for Zhangqiu APK/IPA shell.
# Usage (from laptop / cloud VM):
#   SSHPASS=… bash deploy/web-no-wechat-login/scripts/apply-on-server.sh
# Or on the host after scp:
#   bash /tmp/web-no-wechat-login/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${1:-}"

if [[ -n "$ROOT" ]]; then
  # Local apply on the Next host
  STAMP="$(date +%Y%m%d-%H%M%S)"
  BAK="$ROOT/.web-no-wechat-login-backup-$STAMP"
  mkdir -p "$BAK"
  cp -a "$ROOT/components/login-view.tsx" "$BAK/"
  cp -a "$DIR/opt-patch/components/login-view.tsx" "$ROOT/components/login-view.tsx"
  chown tennis:tennis "$ROOT/components/login-view.tsx"
  sudo -u tennis bash -lc "cd '$ROOT' && npx next build --webpack"
  systemctl restart tennis-ai
  sleep 2
  systemctl is-active tennis-ai
  echo "DONE local apply backup=$BAK"
  exit 0
fi

WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
export SSHPASS="${SSHPASS:-$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)}"
command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS / keychain $KEYCHAIN_SERVICE missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_OPT=/opt/tennis-ai
REMOTE_BAK="$REMOTE_OPT/.web-no-wechat-login-backup-$STAMP"
REMOTE_TMP=/tmp/web-no-wechat-login-$STAMP

echo "== upload bundle =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$DIR/opt-patch" "$DIR/scripts" "$WEB_HOST:$REMOTE_TMP/"

echo "== apply on server =="
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' '$REMOTE_OPT'"

echo "== probe login HTML (no WeChat; register-first) =="
HTML="$(curl -sS 'https://yqchen.blog/tennis/login')"
echo "$HTML" | grep -q 'data-auth-default="signup"' || { echo "missing register-first default" >&2; exit 1; }
echo "$HTML" | grep -q 'data-signup-form="true"' || { echo "signup form not default-rendered" >&2; exit 1; }
if echo "$HTML" | grep -q 'data-wechat-login="true"'; then
  echo "FAIL: WeChat login still present on web" >&2
  exit 1
fi
echo "$HTML" | grep -qi 'Continue with WeChat\|微信登录' && {
  echo "FAIL: WeChat login copy still present on web" >&2
  exit 1
}
echo "OK: web auth defaults to register; no WeChat button"
echo "DONE $STAMP backup=$REMOTE_BAK"
