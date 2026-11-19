#!/usr/bin/env bash
# Safe prod rebuild: never leave a live next-start process on a half-written .next.
# Usage: sudo bash /opt/tennis-ai/scripts/atomic-next-rebuild.sh
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"
LOG="${ATOMIC_NEXT_LOG:-/tmp/tennis-ai-atomic-build-$(date +%Y%m%d-%H%M%S).log}"
cd "$ROOT"
echo "ATOMIC_BUILD_START $(date -Iseconds)" | tee "$LOG"
systemctl stop tennis-ai
# Ensure tennis can unlink prior artifacts (root-owned leftovers cause EACCES mid-build).
chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
mkdir -p "$ROOT/.next"
chown tennis:tennis "$ROOT/.next"
# Build as tennis with a clean slate under .next (service is stopped).
sudo -u tennis -H bash -lc "cd '$ROOT' && rm -rf .next/* && npm run build" 2>&1 | tee -a "$LOG"
test -f "$ROOT/.next/BUILD_ID"
chown -R tennis:tennis "$ROOT/.next"
systemctl start tennis-ai
systemctl is-active tennis-ai | tee -a "$LOG"
echo "ATOMIC_BUILD_DONE $(date -Iseconds) BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")" | tee -a "$LOG"
