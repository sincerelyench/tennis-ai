#!/usr/bin/env bash
# Apply /tai static titles-only progress on GPU host (47.93.203.28).
# Usage: bash deploy/analyze-progress-titles/scripts/apply-gpu.sh /root/workspace/tennis-ai
set -euo pipefail

ROOT="${1:-${GPU_ROOT:-/root/workspace/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/gpu-patch/web/static/index.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

DEST=""
for cand in \
  "$ROOT/web/static/index.html" \
  /root/workspace/tennis-ai/web/static/index.html \
  /root/workspace/web/static/index.html \
  /tai/web/static/index.html
do
  if [[ -f "$cand" ]]; then DEST="$cand"; break; fi
done

if [[ -z "$DEST" ]]; then
  echo "Could not find web/static/index.html under $ROOT" >&2
  exit 1
fi

BAK="${DEST}.titles-only-backup-${STAMP}"
cp -a "$DEST" "$BAK"
install -m 0644 "$SRC" "$DEST"
echo "  + $DEST (backup $BAK)"

# Restart common /tai unit names if present
for unit in tennis-ai tai tennis-pipeline; do
  if systemctl list-unit-files "$unit.service" >/dev/null 2>&1; then
    systemctl restart "$unit" 2>/dev/null || true
    echo "  restarted $unit"
  fi
done

echo "GPU /tai static progress steps are titles-only."
