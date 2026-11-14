#!/usr/bin/env bash
# Apply score-confirm-copy: pending/confirm copy 集锦→比赛结果和综述.
# Code only. No wipe scripts. No casual DB writes.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.score-confirm-copy-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/app/api/friends/scores/[id]/highlight"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/scores/[id]/highlight/route.ts" \
  "$BACKUP/app/api/friends/scores/[id]/highlight/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/app/api/friends/scores/[id]/highlight"

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/[id]/highlight/route.ts" \
  "$ROOT/app/api/friends/scores/[id]/highlight/route.ts"

# Legacy inject (if still served): align savedPending toast
for inject in \
  "$ROOT/public/zq-friends-score-inject.js" \
  "$ROOT/public/assets/zq-friends-score-inject.js"
do
  if [[ -f "$inject" ]]; then
    cp -a "$inject" "$BACKUP/$(basename "$inject")" 2>/dev/null || true
    sed -i \
      -e 's/已提交，等待对方确认/比赛结果和综述等对方确认/g' \
      -e 's/Submitted — waiting for opponent/Match result and review sent — waiting for opponent/g' \
      "$inject" || true
  fi
done

echo "==> Verify copy (must not say 集锦待/等对方确认)"
if grep -nE '集锦(待|等)对方确认' "$ROOT/lib/i18n/messages.ts"; then
  echo "FAIL: leftover 集锦 confirm-waiting copy in messages.ts" >&2
  exit 1
fi
if grep -n '集锦待对方确认' "$ROOT/app/api/friends/scores/[id]/highlight/route.ts"; then
  echo "FAIL: leftover API error copy" >&2
  exit 1
fi
grep -n '比赛结果和综述等对方确认\|cityResultsVideoSection: "集锦"\|打开集锦' \
  "$ROOT/lib/i18n/messages.ts" | head -20

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/SCORE-CONFIRM-COPY-NOTE.txt <<EOF
score-confirm-copy
Applied: $STAMP
Change: pending/confirm notices no longer say 集锦等/待对方确认;
  use 比赛结果和综述等对方确认 (and related 比赛综述 entry/edit/save).
Keep 「集锦」 only as video section title inside 比赛综述 (cityResultsVideoSection)
  and 「打开集锦」 link label.
Web: /opt/tennis-ai messages.ts + highlight route (+ inject toast if present)
APK/IPA/mp: WebView → live /tennis (no binary rebuild required)
EOF
chmod 644 /var/www/apk/SCORE-CONFIRM-COPY-NOTE.txt || true

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
echo "DONE apply score-confirm-copy (no DB writes)"
