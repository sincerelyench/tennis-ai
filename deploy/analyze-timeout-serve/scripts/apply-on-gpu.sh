#!/usr/bin/env bash
# Apply GPU-side timeout/busy fixes on 47.93.203.28.
# Expects repo files already copied into APP.
set -euo pipefail
APP="${APP:-/root/workspace/tennis-ai}"
cd "$APP"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ".analyze-timeout-serve-backup-$STAMP"
for f in web/app.py web/api_errors.py pipeline/session.py web/static/e1.js miniprogram/utils/api.js; do
  [ -f "$f" ] && cp -a "$f" ".analyze-timeout-serve-backup-$STAMP/"
done
echo "backup → $APP/.analyze-timeout-serve-backup-$STAMP"

# Syntax check
./.venv/bin/python -m py_compile web/app.py web/api_errors.py pipeline/session.py

systemctl restart tennis-ai.service
sleep 3
systemctl is-active tennis-ai.service
curl -sS -m 10 http://127.0.0.1:27116/api/health | ./.venv/bin/python -m json.tool | head -30
echo "DONE gpu apply $STAMP"
