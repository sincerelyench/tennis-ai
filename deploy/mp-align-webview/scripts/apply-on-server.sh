#!/usr/bin/env bash
# Apply mp-enter auth handoff to /opt/tennis-ai and restart tennis-ai.
set -euo pipefail
ROOT="${ROOT:-/opt/tennis-ai}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$ROOT/app/api/auth/mp-enter"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/mp-enter/route.ts" "$ROOT/app/api/auth/mp-enter/route.ts"

python3 - <<'PY'
from pathlib import Path
path = Path("/opt/tennis-ai/middleware.ts")
text = path.read_text(encoding="utf-8")
needle = '"/api/auth/wechat",'
insert = '"/api/auth/wechat",\n  "/api/auth/mp-enter",'
if "/api/auth/mp-enter" not in text:
    if needle not in text:
        raise SystemExit("middleware.ts: cannot find wechat public path")
    text = text.replace(needle, insert, 1)
    path.write_text(text, encoding="utf-8")
    print("middleware: added /api/auth/mp-enter")
else:
    print("middleware: mp-enter already public")
PY

chown -R tennis:tennis "$ROOT/app/api/auth/mp-enter" "$ROOT/middleware.ts"
# Next.js production needs a rebuild when route files change.
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> next build (may take a few minutes)"
  sudo -u tennis -H bash -lc "cd '$ROOT' && npm run build"
fi
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai
echo "==> smoke mp-enter (expect 307/302 to login without token)"
curl -sI "http://127.0.0.1:43127/tennis/api/auth/mp-enter" | head -8
echo "done"
