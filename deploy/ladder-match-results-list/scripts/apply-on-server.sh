#!/usr/bin/env bash
# Apply ZQ-121: confirmed match results list under 本地排行 (city-scoped).
# Code only. No wipe scripts. No casual DB writes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-match-results-list-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components" \
  "$BACKUP/app/api/friends/scores"

cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/route.ts" "$BACKUP/app/api/friends/scores/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/components" \
  "$ROOT/app/api/friends/scores"

cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/route.ts" "$ROOT/app/api/friends/scores/route.ts"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/LADDER-MATCH-RESULTS-LIST-NOTE.txt <<EOF
ZQ-121 ladder-match-results-list
Applied: $STAMP
Change: under 本地排行, list all confirmed match results for current city;
tap row for highlights + comments (ZQ-115 APIs).
Web: /opt/tennis-ai friends-view + scores API + match-scores + messages
APK/IPA/mp: WebView → live /tennis (no binary rebuild required for this UI change)
EOF
chmod 644 /var/www/apk/LADDER-MATCH-RESULTS-LIST-NOTE.txt || true

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
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true
curl -sf -o /dev/null -w "scores_city_options:%{http_code}\n" \
  -X OPTIONS "http://127.0.0.1:43127/tennis/api/friends/scores?scope=city&cityId=wuxi" || true
echo "DONE apply ladder-match-results-list (no DB writes)"
