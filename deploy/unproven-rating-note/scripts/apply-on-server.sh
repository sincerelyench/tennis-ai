#!/usr/bin/env bash
# Apply unproven-rating-note: small caption for unplayed ladder ratings.
# Code-only. Does NOT modify Postgres / auth blobs.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.unproven-rating-note-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/UNPROVEN-RATING-NOTE.txt <<EOF
unproven-rating-note
Applied: $STAMP
Change: unplayed local-ladder ratings keep plain X.X (no ?); small caption 「评分未经比赛证明」 under/near score.
UTR/level help ? icons unchanged.
Web: /opt/tennis-ai friends-view + messages
APK/IPA/mp: WebView → live /tennis (no binary rebuild required for this UI-only change)
EOF
chmod 644 /var/www/apk/UNPROVEN-RATING-NOTE.txt || true

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
# Verify built assets contain new copy and not trailing-? pattern from old UX
if rg -l '评分未经比赛证明' "$ROOT/.next" 2>/dev/null | head -3; then
  echo "OK: 评分未经比赛证明 present in .next"
else
  echo "WARN: 评分未经比赛证明 not found in .next; check live JS"
fi
if rg -n 'toFixed\(1\)\?' "$ROOT/components/friends-view.tsx" 2>/dev/null; then
  echo "WARN: trailing ? pattern still in friends-view source"
else
  echo "OK: no trailing ? rating pattern in friends-view"
fi
echo "DONE apply unproven-rating-note (no DB writes)"
