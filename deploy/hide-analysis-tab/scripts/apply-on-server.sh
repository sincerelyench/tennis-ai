#!/usr/bin/env bash
# 涨球 · temporarily hide bottom-nav 「分析」 (SHOW_ANALYSIS_TAB=false)
# Apply on 8.216.53.29 (/opt/tennis-ai). Routes/backend kept; flip flag to restore.
#
# Usage:
#   bash deploy/hide-analysis-tab/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.hide-analysis-tab-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -f "$PATCH/lib/feature-flags.ts" ]]; then
  echo "Missing $PATCH/lib/feature-flags.ts" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/app-shell.tsx" ]]; then
  echo "Missing $PATCH/components/app-shell.tsx" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"

copy_bak() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    local rel
    rel="$(realpath --relative-to="$ROOT" "$dest" 2>/dev/null || echo "$dest")"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$dest" "$BACKUP/$rel"
  fi
  install -D -m 0644 "$src" "$dest"
  echo "  + $dest"
}

install -d \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/app/(main)/analysis" \
  "$ROOT/app/(main)/reports"

copy_bak "$PATCH/lib/feature-flags.ts" "$ROOT/lib/feature-flags.ts"
copy_bak "$PATCH/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"
copy_bak "$PATCH/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"
copy_bak "$PATCH/app/(main)/analysis/layout.tsx" "$ROOT/app/(main)/analysis/layout.tsx"
copy_bak "$PATCH/app/(main)/reports/page.tsx" "$ROOT/app/(main)/reports/page.tsx"

chown -R tennis:tennis \
  "$ROOT/lib/feature-flags.ts" \
  "$ROOT/components/app-shell.tsx" \
  "$ROOT/components/profile-view.tsx" \
  "$ROOT/app/(main)/analysis/layout.tsx" \
  "$ROOT/app/(main)/reports/page.tsx" \
  2>/dev/null || true

echo
echo "==> build + restart tennis-ai (webpack; Next 16 default turbopack breaks next/font/google)"
cd "$ROOT"
rm -rf "$ROOT/.next"
if id tennis >/dev/null 2>&1; then
  sudo -u tennis -H bash -lc "cd '$ROOT' && npx next build --webpack"
else
  npx next build --webpack
fi
systemctl restart tennis-ai
systemctl is-active tennis-ai
test -f "$ROOT/.next/BUILD_ID"
echo "DONE hide-analysis-tab @ $STAMP (SHOW_ANALYSIS_TAB=false → restore: set true + rebuild)"
