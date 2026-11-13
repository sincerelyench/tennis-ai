#!/usr/bin/env bash
# ZQ-131: after score confirm, bind real player phones (not same-name twins)
# and refresh ladder + city「比赛结果」on the client.
# Code-only. Does NOT modify Postgres / auth blobs / match scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-confirm-refresh-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components"
cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/LADDER-CONFIRM-REFRESH-NOTE.txt <<EOF
ZQ-131 ladder-confirm-refresh
Applied: $STAMP
Change:
- Score create/confirm binds submitter + confirming session phones (never same-name twin ids)
- resolveUserIdByName prefers same city / non-demo 1390000000x when names collide
- After confirm: client refetches ladder + city「比赛结果」
- While pending scores exist: client polls every 4s so the submitter sees live updates
Web: /opt/tennis-ai match-scores + friends-view
APK/IPA/mp: WebView → live /tennis (no binary rebuild)
NOTE: Existing wrong playerAId on confirmed scores still need a one-row DB fix (Yanqing OK).
EOF
chmod 644 /var/www/apk/LADDER-CONFIRM-REFRESH-NOTE.txt || true

echo "==> Sanity"
grep -n "preferPhone" "$ROOT/lib/match-scores.ts" | head -5
grep -n "录入方等待对方确认时轮询" "$ROOT/components/friends-view.tsx" | head -3
grep -n "refreshCityMatches()" "$ROOT/components/friends-view.tsx" | head -10

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
echo "DONE apply ladder-confirm-refresh (no DB writes)"
