#!/usr/bin/env bash
# Apply: 我的约球 missing invites — prefer buddyId / honor ladder target (ZQ-125)
# Code-only by default. Optional DB rebind: YUEQIU_REBIND_TWIN=1
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.yueqiu-missing-invites-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib"
cp -a "$ROOT/lib/match-intros.ts" "$BACKUP/lib/" 2>/dev/null || true

echo "==> Install opt-patch (match-intros.ts)"
mkdir -p "$ROOT/lib"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"

if [[ -f "$PATCH_DIR/mp-patch/YUEQIU-MISSING-INVITES-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/YUEQIU-MISSING-INVITES-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ "${YUEQIU_REBIND_TWIN:-0}" == "1" ]]; then
  echo "==> Optional twin toPhone rebind (patterned 陈燕青 id-binding)"
  bash "$PATCH_DIR/scripts/rebind-yanqing-twin-intro.on-server.sh" "$BACKUP"
fi

echo "==> Build Next app"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npx next build --webpack || npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
echo "DONE apply yueqiu-missing-invites backup=$BACKUP"
