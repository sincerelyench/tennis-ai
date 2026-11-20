#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mp-error-hard-reload-backup-$STAMP"
mkdir -p "$BACKUP/app/(main)" "$BACKUP/components" "$BACKUP/lib/i18n"
cp -a "$ROOT/app/(main)/error.tsx" "$BACKUP/app/(main)/" 2>/dev/null || true
cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true

cp -a "$PATCH_DIR/opt-patch/app/(main)/error.tsx" "$ROOT/app/(main)/error.tsx"
cp -a "$PATCH_DIR/opt-patch/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"

# Generic error copy (not analysis-only) — ladder/friends share (main)/error.tsx
ROOT="$ROOT" python3 - <<'PY'
from pathlib import Path
import os
p = Path(os.environ["ROOT"]) / "lib/i18n/messages.ts"
t = p.read_text()
repls = [
  ('pageDesc: "Training data is unavailable right now. Please try again."',
   'pageDesc: "This page could not load. Please try again."'),
  ('pageDesc: "训练数据暂时不可用，请再试一次。"',
   'pageDesc: "页面暂时不可用，请再试一次。"'),
]
for a,b in repls:
  if a not in t:
    raise SystemExit(f"missing i18n needle: {a}")
  t = t.replace(a, b, 1)
p.write_text(t)
print("i18n pageDesc updated")
PY

grep -n "ZQ-164c\|data-error-retry\|MicroMessenger" "$ROOT/app/(main)/error.tsx" "$ROOT/components/app-shell.tsx"
grep -n '页面暂时不可用\|This page could not load' "$ROOT/lib/i18n/messages.ts"

cd "$ROOT"
export ROOT
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npm run build
  systemctl start tennis-ai
fi
echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE ZQ-164c mp-error-hard-reload backup=$BACKUP"
