#!/usr/bin/env bash
# 涨球 · embed sslip analyze UI — apply on 8.216.53.29 (/opt/tennis-ai)
# Replaces /analysis (+ /analysis/new) with an iframe of
# https://tennis.47.93.203.28.sslip.io/
#
# Usage:
#   bash deploy/embed-analyze-sslip/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.embed-analyze-sslip-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/analyze-embed.tsx" ]]; then
  echo "Missing $PATCH/components/analyze-embed.tsx" >&2
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
  "$ROOT/components" \
  "$ROOT/app/(main)/analysis" \
  "$ROOT/app/(main)/analysis/new"

copy_bak "$PATCH/components/analyze-embed.tsx" "$ROOT/components/analyze-embed.tsx"
copy_bak "$PATCH/components/analysis-view.tsx" "$ROOT/components/analysis-view.tsx"
copy_bak "$PATCH/app/(main)/analysis/page.tsx" "$ROOT/app/(main)/analysis/page.tsx"
copy_bak "$PATCH/app/(main)/analysis/new/page.tsx" "$ROOT/app/(main)/analysis/new/page.tsx"

echo
echo "==> build + restart tennis-ai"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  sudo -u tennis -H bash -lc "cd '$ROOT' && npm run build"
else
  npm run build
fi
systemctl restart tennis-ai
systemctl is-active tennis-ai
echo "DONE embed-analyze-sslip @ $STAMP"
