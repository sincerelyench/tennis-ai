#!/usr/bin/env bash
# Apply stroke-pass-fix: GPU /tai normalize + optional APK upload.
# Run on a machine with SSH (yanqing Mac Keychain path from prior deploys).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_HOST="${WEB_HOST:-root@8.216.53.29}"
GPU_HOST="${GPU_HOST:-root@47.93.203.28}"
OPT_GPU="${OPT_GPU:-/opt/tennis-ai}"
APK_SRC="${APK_SRC:-}"
APK_DEST="${APK_DEST:-/var/www/html/tennis-ai.apk}"
# Common alternate paths seen in prior deploys
APK_DEST_ALT="${APK_DEST_ALT:-/var/www/apk/tennis-ai.apk}"

echo "== GPU sync stroke normalize =="
ssh -o StrictHostKeyChecking=accept-new "$GPU_HOST" "mkdir -p /tmp/stroke-pass-fix"
scp -o StrictHostKeyChecking=accept-new \
  "$ROOT/algo/stroke.py" \
  "$ROOT/algo/session.py" \
  "$ROOT/algo/technique.py" \
  "$ROOT/algo/analyze.py" \
  "$ROOT/algo/coach.py" \
  "$ROOT/algo/progress.py" \
  "$ROOT/algo/patch-app-normalize.py" \
  "$GPU_HOST:/tmp/stroke-pass-fix/"
ssh "$GPU_HOST" "set -e
  OPT='$OPT_GPU'
  cp /tmp/stroke-pass-fix/stroke.py \"\$OPT/pipeline/stroke.py\"
  cp /tmp/stroke-pass-fix/session.py \"\$OPT/pipeline/session.py\"
  cp /tmp/stroke-pass-fix/technique.py \"\$OPT/pipeline/technique.py\"
  cp /tmp/stroke-pass-fix/analyze.py \"\$OPT/pipeline/analyze.py\"
  cp /tmp/stroke-pass-fix/coach.py \"\$OPT/pipeline/coach.py\"
  cp /tmp/stroke-pass-fix/progress.py \"\$OPT/web/progress.py\"
  python3 /tmp/stroke-pass-fix/patch-app-normalize.py \"\$OPT\"
  systemctl restart tennis-ai-api 2>/dev/null || systemctl restart uvicorn 2>/dev/null || \
    systemctl restart tennis-ai 2>/dev/null || echo 'WARN: restart FastAPI unit manually'
  curl -sS http://127.0.0.1:27116/api/health || curl -sS http://127.0.0.1/tai/api/health || true
"

echo "== APK upload =="
if [[ -n "${APK_SRC}" && -f "${APK_SRC}" ]]; then
  scp "${APK_SRC}" "${WEB_HOST}:/tmp/tennis-ai.apk"
  ssh "$WEB_HOST" "set -e
    if [[ -d \$(dirname $APK_DEST) ]]; then DEST=$APK_DEST
    elif [[ -d \$(dirname $APK_DEST_ALT) ]]; then DEST=$APK_DEST_ALT
    else DEST=/var/www/html/tennis-ai.apk; mkdir -p /var/www/html; fi
    install -m 644 /tmp/tennis-ai.apk \"\$DEST\"
    ls -la \"\$DEST\"
    # also copy to known nginx alias paths
    for p in /var/www/html/tennis-ai.apk /usr/share/nginx/html/tennis-ai.apk /opt/tennis-ai/public/tennis-ai.apk; do
      d=\$(dirname \"\$p\"); [[ -d \"\$d\" ]] && install -m 644 /tmp/tennis-ai.apk \"\$p\" || true
    done
  "
  echo "Live: https://yqchen.blog/tennis-ai.apk"
else
  echo "Skip APK upload (export APK_SRC=/path/to/tennis-ai-1.0.80.apk)"
fi
echo DONE
