#!/usr/bin/env bash
# Apply ZQ-136 A+B+C: EXCLUDE_GAP 1.5 + soft exclude + UI hints.
# Code-only. Does NOT modify Postgres / auth blobs / match scores.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.exclude-gap-soft-abc-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components"

cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/journey-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/journey-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/EXCLUDE-GAP-SOFT-ABC-NOTE.txt <<EOF
ZQ-136 exclude-gap-soft-abc (A+B+C)
Applied: $STAMP
A: EXCLUDE_GAP 1.0 → 1.5 (full weight for ~3.0 vs 2.5)
B: gap > 1.5 favorite win → soft credit MR=pre+0.05 @ weight×0.25 (not hard Δ=0)
C: journey + ladder recent match Chinese hints (soft / barely / 未完全计入)
Web: /opt/tennis-ai local-ladder + messages + journey-view + friends-view
APK/IPA/mp: WebView → live /tennis (no binary rebuild; rating math server-side)
EOF
chmod 644 /var/www/apk/EXCLUDE-GAP-SOFT-ABC-NOTE.txt || true
cp -a /var/www/apk/EXCLUDE-GAP-SOFT-ABC-NOTE.txt \
  "$PATCH_DIR/EXCLUDE-GAP-SOFT-ABC-NOTE.txt" 2>/dev/null || true

echo "==> Sanity: EXCLUDE_GAP 1.5 + soft constants + UI keys"
grep -n "EXCLUDE_GAP = 1.5" "$ROOT/lib/local-ladder.ts"
grep -n "SOFT_EXCLUDE_BOOST = 0.05" "$ROOT/lib/local-ladder.ts"
grep -n "SOFT_EXCLUDE_WEIGHT = 0.25" "$ROOT/lib/local-ladder.ts"
grep -n "softExcludeHint" "$ROOT/lib/i18n/messages.ts" | head -5
grep -n "barelyCountHint" "$ROOT/lib/i18n/messages.ts" | head -5
grep -n "softExcluded" "$ROOT/components/journey-view.tsx" | head -5

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
echo "DONE apply exclude-gap-soft-abc (no DB writes)"
