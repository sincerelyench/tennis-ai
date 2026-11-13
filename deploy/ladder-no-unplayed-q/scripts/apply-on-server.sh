#!/usr/bin/env bash
# Apply ZQ-117: remove unplayed ladder score "?" / italic / seedOnly hint.
# Code-only. Does NOT modify Postgres / auth blobs.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-no-unplayed-q-backup-$STAMP"

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
cat > /var/www/apk/LADDER-NO-UNPLAYED-Q-NOTE.txt <<EOF
ZQ-117 ladder-no-unplayed-q
Applied: $STAMP
Change: local ladder scores show plain numbers; no trailing ? / italic / unplayed hint.
UTR/level help ? icons unchanged.
Web: /opt/tennis-ai friends-view + messages
APK/IPA/mp: WebView → live /tennis (no binary rebuild required for this UI-only change)
EOF
chmod 644 /var/www/apk/LADDER-NO-UNPLAYED-Q-NOTE.txt || true

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
# Verify built assets no longer contain unplayed hint phrase
if rg -l '尚未经过比赛考验' "$ROOT/.next" 2>/dev/null | head -3; then
  echo "WARN: phrase still present in .next (may be stale chunk); check live JS"
else
  echo "OK: 尚未经过比赛考验 absent from .next"
fi
echo "DONE apply ladder-no-unplayed-q (no DB writes)"
