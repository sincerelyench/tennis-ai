#!/usr/bin/env bash
# Hot-patch GPU /tai E1 auth: allow miniprogram/android/ios uploads when
# /tennis proxy strips Authorization (fixes live 401 auth_required).
set -euo pipefail
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
REMOTE_ROOT="${REMOTE_ROOT:-/root/workspace/tennis-ai}"
KEYCHAIN_SERVICE="${PROD_SSH_KEYCHAIN_SERVICE:-voice-diary-prod-ssh}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PATCH_SRC="$DIR/../gpu-patch/_prepare_upload_meta.py.txt"

command -v sshpass >/dev/null || { echo "sshpass not found" >&2; exit 1; }
PASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
[[ -n "$PASS" ]] || { echo "Keychain $KEYCHAIN_SERVICE empty" >&2; exit 1; }
export SSHPASS="$PASS"
SSH=(sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
SCP=(sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)

STAMP=$(date +%Y%m%d-%H%M%S)
echo "== backup + patch $GPU_HOST:$REMOTE_ROOT/web/app.py =="
"${SCP[@]}" "$PATCH_SRC" "$GPU_HOST:/tmp/_prepare_upload_meta.py.txt"
"${SSH[@]}" "$GPU_HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_ROOT"
cp -a web/app.py "web/app.py.e1-auth-backup-$STAMP"
python3 - <<'PY'
from pathlib import Path
app = Path("web/app.py")
text = app.read_text(encoding="utf-8")
new_fn = Path("/tmp/_prepare_upload_meta.py.txt").read_text(encoding="utf-8")
start = text.index("def _prepare_upload_meta(")
# replace through next top-level def after this function
rest = text[start:]
# find end: next \ndef at column 0 after the function body
import re
m = re.match(r"def _prepare_upload_meta\([\s\S]*?(?=\ndef [a-zA-Z_])", rest)
if not m:
    raise SystemExit("could not locate _prepare_upload_meta block")
app.write_text(text[:start] + new_fn + rest[m.end():], encoding="utf-8")
print("patched bytes", len(new_fn))
PY
python3 -m py_compile web/app.py
# restart API — prefer systemd, else pkill+nohup common pattern
if systemctl list-units --type=service 2>/dev/null | grep -q tennis; then
  systemctl restart tennis-ai || systemctl restart tennis-ai-api || true
fi
pkill -f 'uvicorn web.app:app' 2>/dev/null || true
sleep 1
# try start if no process
if ! pgrep -f 'uvicorn web.app' >/dev/null 2>&1; then
  if [[ -f run_web.sh ]]; then
    nohup bash run_web.sh >/tmp/tennis-ai-api.log 2>&1 &
  fi
fi
sleep 2
curl -sS http://127.0.0.1:8000/api/health | head -c 200 || curl -sS http://127.0.0.1:8080/api/health | head -c 200 || true
echo
REMOTE

echo "== public probe =="
curl -sS "https://yqchen.blog/tai/api/health" | head -c 200; echo
echo "apply-gpu done. Re-test: POST /tennis/api/analyze with client=miniprogram after tennis login."
