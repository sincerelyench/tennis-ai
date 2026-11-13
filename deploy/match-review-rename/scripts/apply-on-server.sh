#!/usr/bin/env bash
# Apply match-review-rename: 比赛结果「集锦」→「比赛综述」+ video/text sections.
# Code only. No wipe scripts. No casual DB writes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.match-review-rename-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/components"

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/MATCH-REVIEW-RENAME-NOTE.txt <<EOF
match-review-rename
Applied: $STAMP
Change: 比赛结果 row button 集锦→比赛综述; dialog title 比赛综述;
  with video → 「集锦」 section; text-only → 「比赛综述介绍」.
Confirm-gate unchanged (ZQ-115).
Web: /opt/tennis-ai friends-view + messages
APK/IPA/mp: WebView → live /tennis (no binary rebuild required)
EOF
chmod 644 /var/www/apk/MATCH-REVIEW-RENAME-NOTE.txt || true

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
echo "DONE apply match-review-rename (no DB writes)"
