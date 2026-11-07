#!/usr/bin/env bash
# 涨球 · restore in-app analyze UI — apply on 8.216.53.29 (/opt/tennis-ai)
# Removes sslip iframe embed; restores upload/trim/progress/report flow.
# Analysis jobs still use the sslip GPU stack via existing nginx /tai proxy
# (http://47.93.203.28/tennis-ai/ — same service as tennis.*.sslip.io).
#
# Usage:
#   bash deploy/restore-analyze-inapp/scripts/apply-on-server.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.restore-analyze-inapp-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/analysis-view.tsx" ]]; then
  echo "Missing $PATCH/components/analysis-view.tsx" >&2
  exit 1
fi
if [[ ! -f "$PATCH/components/analysis-job-deeplink.tsx" ]]; then
  echo "Missing $PATCH/components/analysis-job-deeplink.tsx" >&2
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

copy_bak "$PATCH/components/analysis-view.tsx" "$ROOT/components/analysis-view.tsx"
copy_bak "$PATCH/components/analysis-job-deeplink.tsx" "$ROOT/components/analysis-job-deeplink.tsx"
copy_bak "$PATCH/app/(main)/analysis/page.tsx" "$ROOT/app/(main)/analysis/page.tsx"
copy_bak "$PATCH/app/(main)/analysis/new/page.tsx" "$ROOT/app/(main)/analysis/new/page.tsx"

# Drop iframe embed helper if present (no longer referenced).
if [[ -f "$ROOT/components/analyze-embed.tsx" ]]; then
  rel="components/analyze-embed.tsx"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$ROOT/components/analyze-embed.tsx" "$BACKUP/$rel"
  rm -f "$ROOT/components/analyze-embed.tsx"
  echo "  - $ROOT/components/analyze-embed.tsx"
fi

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
echo "DONE restore-analyze-inapp @ $STAMP"
