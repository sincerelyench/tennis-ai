#!/usr/bin/env bash
# Unify 「完善资料」 gate: only logged-in + missing display name.
# Usage (from laptop / cloud VM):
#   SSHPASS=… bash deploy/profile-dialog-gate/scripts/apply-on-server.sh
# Or on the host after scp:
#   bash /tmp/profile-dialog-gate/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${1:-}"

apply_local() {
  local root="$1"
  local stamp bak
  stamp="$(date +%Y%m%d-%H%M%S)"
  bak="$root/.profile-dialog-gate-backup-$stamp"
  mkdir -p "$bak/components" "$bak/lib"
  cp -a "$root/components/profile-setup.tsx" "$bak/components/"
  cp -a "$root/lib/auth-store.ts" "$bak/lib/"
  cp -a "$root/lib/session-role.ts" "$bak/lib/"
  cp -a "$DIR/opt-patch/components/profile-setup.tsx" "$root/components/profile-setup.tsx"
  cp -a "$DIR/opt-patch/lib/auth-store.ts" "$root/lib/auth-store.ts"
  cp -a "$DIR/opt-patch/lib/session-role.ts" "$root/lib/session-role.ts"
  chown tennis:tennis \
    "$root/components/profile-setup.tsx" \
    "$root/lib/auth-store.ts" \
    "$root/lib/session-role.ts"
  sudo -u tennis bash -lc "cd '$root' && npx next build --webpack"
  systemctl restart tennis-ai
  sleep 2
  systemctl is-active tennis-ai
  echo "DONE local apply backup=$bak"
}

if [[ -n "$ROOT" ]]; then
  apply_local "$ROOT"
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
REMOTE_TMP=/tmp/profile-dialog-gate-$STAMP

echo "== upload bundle =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$DIR/opt-patch" "$DIR/scripts" "$WEB_HOST:$REMOTE_TMP/"

echo "== apply on server =="
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' '$REMOTE_OPT'"

echo "== smoke session endpoints =="
curl -sS -o /dev/null -w "login_page %{http_code}\n" "https://yqchen.blog/tennis/login"
echo "DONE $STAMP"
