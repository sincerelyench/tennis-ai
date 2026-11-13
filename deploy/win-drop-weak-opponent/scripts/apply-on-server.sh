#!/usr/bin/env bash
# Apply ZQ-122: win vs much-weaker → rating unchanged; counted wins never lower rating.
# Code-only. Does NOT modify Postgres / auth blobs / match scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.win-drop-weak-opponent-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components"

cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/journey-view.tsx"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/WIN-DROP-WEAK-OPPONENT-NOTE.txt <<EOF
ZQ-122 win-drop-weak-opponent (algorithm-first)
Applied: $STAMP
Change:
- EXCLUDE_GAP 2.0 → 1.0: favorite win vs much weaker → rating unchanged (Δ=0)
- Counted wins floor match rating at pre-match rating → win never lowers published rating
- Gains mainly from beating similar-level opponents
- Journey residual: if win still shows negative Δ, short hint「赢球掉分：对手比自己弱」
Web: /opt/tennis-ai local-ladder + messages + journey-view
APK/IPA/mp: WebView → live /tennis (no binary rebuild required; rating math is server-side)
EOF
chmod 644 /var/www/apk/WIN-DROP-WEAK-OPPONENT-NOTE.txt || true
cp -a /var/www/apk/WIN-DROP-WEAK-OPPONENT-NOTE.txt \
  "$PATCH_DIR/WIN-DROP-WEAK-OPPONENT-NOTE.txt" 2>/dev/null || true

echo "==> Sanity: EXCLUDE_GAP + winner floor present"
grep -n "EXCLUDE_GAP = 1.0" "$ROOT/lib/local-ladder.ts"
grep -n "Math.max(mrWin, winSide)" "$ROOT/lib/local-ladder.ts"
grep -n "winDropWeakHint" "$ROOT/lib/i18n/messages.ts" | head -5

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
curl -sf -o /dev/null -w "journey:%{http_code}\n" http://127.0.0.1:43127/tennis/journey || true
echo "DONE apply win-drop-weak-opponent (no DB writes)"
