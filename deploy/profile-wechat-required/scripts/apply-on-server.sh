#!/usr/bin/env bash
# Deploy 完善资料微信号 + name/wechat gate + post-accept reveal.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${1:-}"

apply_local() {
  local root="$1"
  local stamp bak
  stamp="$(date +%Y%m%d-%H%M%S)"
  bak="$root/.profile-wechat-required-backup-$stamp"
  mkdir -p "$bak"/{components,lib/i18n,app/api/auth/profile,app/api/auth/session}
  for f in \
    components/profile-setup.tsx \
    components/friends-view.tsx \
    lib/auth-store.ts \
    lib/session-role.ts \
    lib/match-intros.ts \
    lib/i18n/messages.ts \
    app/api/auth/profile/route.ts \
    app/api/auth/session/route.ts
  do
    mkdir -p "$bak/$(dirname "$f")"
    cp -a "$root/$f" "$bak/$f"
    cp -a "$DIR/opt-patch/$f" "$root/$f"
    chown tennis:tennis "$root/$f"
  done
  # Clean broken .next traces then rebuild
  rm -rf "$root/.next"
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
[[ -n "${SSHPASS:-}" ]] || { echo "SSHPASS missing" >&2; exit 1; }

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_TMP=/tmp/profile-wechat-required-$STAMP

echo "== upload =="
"${SSH[@]}" "$WEB_HOST" "mkdir -p '$REMOTE_TMP'"
"${SCP[@]}" -r "$DIR/opt-patch" "$DIR/scripts" "$WEB_HOST:$REMOTE_TMP/"

echo "== apply =="
"${SSH[@]}" "$WEB_HOST" "bash '$REMOTE_TMP/scripts/apply-on-server.sh' /opt/tennis-ai"
echo "DONE $STAMP"
