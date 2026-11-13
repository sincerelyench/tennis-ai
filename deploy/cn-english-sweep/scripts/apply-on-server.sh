#!/usr/bin/env bash
# Apply cn-english-sweep: Chinese locale UI without English leftovers.
# Code-only. Does NOT modify Postgres / auth blobs.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.cn-english-sweep-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p \
  "$BACKUP/lib/i18n" \
  "$BACKUP/components" \
  "$BACKUP/public/assets"

cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/translate.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/page-meta.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/i18n-provider.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/coach-publish-panel.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/public/zq-friends-city-inject.js" "$BACKUP/public/" 2>/dev/null || true
cp -a "$ROOT/public/zq-friends-matchmaking-inject.js" "$BACKUP/public/" 2>/dev/null || true
cp -a "$ROOT/public/zq-friends-score-inject.js" "$BACKUP/public/" 2>/dev/null || true
cp -a "$ROOT/public/assets/zq-friends-city-inject.js" "$BACKUP/public/assets/" 2>/dev/null || true
cp -a "$ROOT/public/assets/zq-friends-matchmaking-inject.js" "$BACKUP/public/assets/" 2>/dev/null || true
cp -a "$ROOT/public/assets/zq-friends-score-inject.js" "$BACKUP/public/assets/" 2>/dev/null || true

echo "==> Install opt-patch (code only)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" "$ROOT/public/assets"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/translate.ts" "$ROOT/lib/i18n/translate.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/page-meta.ts" "$ROOT/lib/i18n/page-meta.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/i18n-provider.tsx" "$ROOT/components/i18n-provider.tsx"
cp -a "$PATCH_DIR/opt-patch/components/coach-publish-panel.tsx" "$ROOT/components/coach-publish-panel.tsx"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-city-inject.js" "$ROOT/public/zq-friends-city-inject.js"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-matchmaking-inject.js" "$ROOT/public/zq-friends-matchmaking-inject.js"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-score-inject.js" "$ROOT/public/zq-friends-score-inject.js"
cp -a "$PATCH_DIR/opt-patch/public/assets/zq-friends-city-inject.js" "$ROOT/public/assets/zq-friends-city-inject.js"
cp -a "$PATCH_DIR/opt-patch/public/assets/zq-friends-matchmaking-inject.js" "$ROOT/public/assets/zq-friends-matchmaking-inject.js"
cp -a "$PATCH_DIR/opt-patch/public/assets/zq-friends-score-inject.js" "$ROOT/public/assets/zq-friends-score-inject.js"

echo "==> Four-surface note"
mkdir -p /var/www/apk
cat > /var/www/apk/CN-ENGLISH-SWEEP-NOTE.txt <<EOF
cn-english-sweep
Applied: $STAMP
Change: zh UI copy without UTR/Universal Tennis/match rating/(P); rating label 等级分; default locale zh.
Web: /opt/tennis-ai messages + friends-view + i18n defaults + injects
APK/IPA/mp: WebView → live /tennis (no binary rebuild required for this UI-only change)
EOF
chmod 644 /var/www/apk/CN-ENGLISH-SWEEP-NOTE.txt || true

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
curl -sf -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:43127/tennis/login || true
curl -sf -o /dev/null -w "friends:%{http_code}\n" http://127.0.0.1:43127/tennis/friends || true

# Verify zh copy markers in source / build
if rg -n '本地等级分' "$ROOT/lib/i18n/messages.ts" >/dev/null 2>&1; then
  echo "OK: 本地等级分 in messages.ts"
else
  echo "WARN: 本地等级分 missing in messages.ts"
fi
if rg -n '\(P\)' "$ROOT/components/friends-view.tsx" >/dev/null 2>&1; then
  echo "WARN: (P) still in friends-view"
else
  echo "OK: no (P) in friends-view"
fi
if rg -n 'UTR 风格' "$ROOT/lib/i18n/messages.ts" >/dev/null 2>&1; then
  echo "WARN: UTR 风格 still in messages.ts (check zh half)"
else
  echo "OK: no UTR 风格 in messages.ts"
fi
echo "DONE apply cn-english-sweep (no DB writes)"
