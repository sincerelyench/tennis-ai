#!/usr/bin/env bash
# ZQ-145: 约球成功列表 — 未录分在前，已录分在后（组内按时间）
# Code only. No DB writes / deletes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.yueqiu-sort-unscored-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components"
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Four-surface note + preview"
mkdir -p /var/www/apk
cp -a "$PATCH_DIR/mp-patch/YUEQIU-SORT-UNSCORED-NOTE.txt" /var/www/apk/YUEQIU-SORT-UNSCORED-NOTE.txt
chmod 644 /var/www/apk/YUEQIU-SORT-UNSCORED-NOTE.txt || true
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/yueqiu-sort-unscored.html
  chmod 644 /var/www/apk/yueqiu-sort-unscored.html || true
fi

echo "==> Sanity"
grep -n "findEnteredScoreBetween\|unscored first\|scoredA" \
  "$ROOT/lib/match-scores.ts" "$ROOT/lib/match-intros.ts" | head -20
grep -n "data-match-success-sort\|orderedSuccessRecords\|successHasEnteredScore\|unscored-first" \
  "$ROOT/components/friends-view.tsx" | head -20

echo "==> Build Next app (before restart)"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npx next build --webpack || npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
echo "DONE apply yueqiu-sort-unscored (no DB writes)"
