#!/usr/bin/env bash
# Run on Mac worker with Keychain service voice-diary-prod-ssh.
# Uploads mp-weixin.zip + README to https://yqchen.blog/mp-weixin.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${PROD_HOST:-root@8.216.53.29}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/apk}"
PASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
export SSHPASS="$PASS"
sshpass -e scp -o StrictHostKeyChecking=accept-new \
  "$ROOT/mp-weixin.zip" \
  "$ROOT/mp-weixin-README.txt" \
  "$HOST:$REMOTE_DIR/"
sshpass -e ssh -o StrictHostKeyChecking=accept-new "$HOST" \
  "chmod 644 $REMOTE_DIR/mp-weixin.zip $REMOTE_DIR/mp-weixin-README.txt && ls -la $REMOTE_DIR/mp-weixin.zip $REMOTE_DIR/mp-weixin-README.txt"
echo "Public: https://yqchen.blog/mp-weixin.zip"
curl -sI "https://yqchen.blog/mp-weixin.zip" | head -8
