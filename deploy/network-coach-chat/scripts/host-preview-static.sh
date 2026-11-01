#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"
cp -a "$ROOT/public/network-coach-chat.html" /var/www/apk/network-coach-chat.html
cp -a "$ROOT/public/assets/zq-network-coach-inject.js" /var/www/apk/zq-network-coach-inject.js
chmod 644 /var/www/apk/network-coach-chat.html /var/www/apk/zq-network-coach-inject.js

python3 - <<'PY'
from pathlib import Path
p = Path("/opt/tennis-ai/middleware.ts")
if not p.exists():
    print("no middleware")
    raise SystemExit(0)
t = p.read_text()
if "network-coach-chat" in t:
    print("middleware already allows")
    raise SystemExit(0)
idx = t.find("export async function middleware")
if idx < 0:
    idx = t.find("export function middleware")
if idx < 0:
    print("middleware marker not found")
    raise SystemExit(0)
brace = t.find("{", idx)
insert = (
    '\n  const p = request.nextUrl.pathname;\n'
    '  if (p.includes("network-coach-chat")) return NextResponse.next();\n'
)
t = t[: brace + 1] + insert + t[brace + 1 :]
p.write_text(t)
print("patched middleware")
PY

# rebuild if middleware changed
if grep -q 'network-coach-chat' "$ROOT/middleware.ts" 2>/dev/null; then
  cd "$ROOT"
  sudo -u tennis npm run build
  systemctl restart tennis-ai || true
fi
echo "hosted /var/www/apk/network-coach-chat.html"
