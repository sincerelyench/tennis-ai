#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOST="${HOST:-root@8.216.53.29}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
PASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w)"
export SSHPASS="$PASS"
SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

TMP="$(mktemp -d)"
(cd "$ROOT/miniprogram" && zip -qr "$TMP/mp-weixin.zip" . -x '*.DS_Store*')
cp "$ROOT/deploy/mp-align-webview/mp-weixin-README.txt" "$TMP/mp-weixin-README.txt"
chmod 644 "$TMP/mp-weixin.zip" "$TMP/mp-weixin-README.txt"

echo "==> upload mp-weixin.zip ($(wc -c < "$TMP/mp-weixin.zip") bytes)"
"${SCP[@]}" "$TMP/mp-weixin.zip" "$TMP/mp-weixin-README.txt" "$HOST:/var/www/apk/"
"${SSH[@]}" "$HOST" 'chmod 644 /var/www/apk/mp-weixin.zip /var/www/apk/mp-weixin-README.txt; ls -la /var/www/apk/mp-weixin*'
curl -sI "https://yqchen.blog/mp-weixin.zip" | head -5
rm -rf "$TMP"
echo "done"
