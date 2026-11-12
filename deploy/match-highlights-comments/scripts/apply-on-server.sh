#!/usr/bin/env bash
# Apply: 约球已录分 — 精彩集锦 + 文字描述 + 评论（Postgres blob）
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.match-highlights-comments-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components" \
  "$BACKUP/app/api/friends/scores"

cp -a "$ROOT/lib/match-scores.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores" "$BACKUP/app/api/friends/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/components" \
  "$ROOT/app/api/friends/scores" \
  "$ROOT/public/match-highlights"

cp -a "$PATCH_DIR/opt-patch/lib/match-scores.ts" "$ROOT/lib/match-scores.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/[id]" "$ROOT/app/api/friends/scores/"

chown -R tennis:tennis "$ROOT/public/match-highlights" 2>/dev/null || true
chmod 755 "$ROOT/public/match-highlights" 2>/dev/null || true

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/match-highlights-comments.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/match-highlights-comments.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/MATCH-HIGHLIGHTS-COMMENTS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/MATCH-HIGHLIGHTS-COMMENTS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
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
curl -sf -o /dev/null -w "highlight_options:%{http_code}\n" \
  -X OPTIONS http://127.0.0.1:43127/tennis/api/friends/scores/ms-demo/highlight || true
echo "DONE apply match-highlights-comments"
