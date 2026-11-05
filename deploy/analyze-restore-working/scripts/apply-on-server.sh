#!/usr/bin/env bash
# Restore working 10s analyze submit on blog Next host.
set -euo pipefail
APP="${APP:-/opt/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cp -a "$ROOT/patches/clip.ts" "$APP/lib/clip.ts"
cp -a "$ROOT/patches/tai.ts" "$APP/lib/tai.ts"
cp -a "$ROOT/patches/analysis-view.tsx" "$APP/components/analysis-view.tsx"
# ensure force-dynamic on main layout
python3 - <<'PY'
from pathlib import Path
path = Path("/opt/tennis-ai/app/(main)/layout.tsx")
text = path.read_text()
if 'export const dynamic = "force-dynamic"' not in text:
    needle = 'import { getSession, sessionCookie } from "@/lib/auth-store";\n'
    text = text.replace(needle, needle + '\nexport const dynamic = "force-dynamic";\n', 1)
    path.write_text(text)
PY
chown tennis:tennis "$APP/lib/clip.ts" "$APP/lib/tai.ts" "$APP/components/analysis-view.tsx" "$APP/app/(main)/layout.tsx"
sudo -u tennis -H bash -lc "cd '$APP' && npm run build"
systemctl restart tennis-ai.service
systemctl is-active tennis-ai.service
