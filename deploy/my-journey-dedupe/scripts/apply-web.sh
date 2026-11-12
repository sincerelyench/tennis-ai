#!/usr/bin/env bash
# Upload kit + apply on production (8.216.53.29). Requires SSHPASS.
set -euo pipefail

HOST="${HOST:-root@8.216.53.29}"
REMOTE_DIR="${REMOTE_DIR:-/tmp/my-journey-dedupe}"
KIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${SSHPASS:-}" ]]; then
  echo "Set SSHPASS for password auth (Keychain voice-diary-prod-ssh)." >&2
  exit 1
fi

SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new)

echo "==> Preflight site"
curl -fsS -o /dev/null -w 'login %{http_code}\n' https://yqchen.blog/tennis/login

echo "==> Upload kit -> $HOST:$REMOTE_DIR"
"${SSH[@]}" "$HOST" "rm -rf '$REMOTE_DIR' && mkdir -p '$REMOTE_DIR'"
"${SCP[@]}" -r "$KIT_DIR/." "$HOST:$REMOTE_DIR/"

echo "==> Apply on server"
"${SSH[@]}" "$HOST" "bash '$REMOTE_DIR/scripts/apply-on-server.sh' /opt/tennis-ai"

echo "==> Postflight"
curl -fsS -o /dev/null -w 'login %{http_code}\n' https://yqchen.blog/tennis/login
"${SSH[@]}" "$HOST" "systemctl is-active tennis-ai; echo '--- journey refs ---'; grep -n 'href: \"/journey\"\\|open-journey\\|journey.title' /opt/tennis-ai/components/profile-view.tsx"
