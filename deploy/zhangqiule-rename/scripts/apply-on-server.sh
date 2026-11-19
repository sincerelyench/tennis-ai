#!/usr/bin/env bash
# ZQ-155: Rename product brand 涨球 → 涨球乐 (four-surface). AI coach stays 「AI 教练」.
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.zhangqiule-rename-backup-$STAMP"
echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"
while IFS= read -r -d '' f; do
  rel="${f#"$PATCH_DIR/opt-patch/"}"
  src="$ROOT/$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$src" "$BACKUP/$rel"
  fi
done < <(find "$PATCH_DIR/opt-patch" -type f -print0)
echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/." "$ROOT/"
if [[ -f "$PATCH_DIR/www-apk/get-zhangqiu.html" ]]; then
  mkdir -p /var/www/apk
  [[ -f /var/www/apk/get-zhangqiu.html ]] && cp -a /var/www/apk/get-zhangqiu.html "$BACKUP/get-zhangqiu.html" || true
  cp -a "$PATCH_DIR/www-apk/get-zhangqiu.html" /var/www/apk/get-zhangqiu.html
  chmod 644 /var/www/apk/get-zhangqiu.html || true
fi
mkdir -p /var/www/apk
cat > /var/www/apk/ZHANGQIULE-RENAME-NOTE.txt <<'NOTE'
涨球乐 rename (ZQ-155)
- Product brand 涨球 → 涨球乐 across /tennis i18n, onboarding, get-zhangqiu, share metadata.
- AI coach display remains 「AI 教练」.
NOTE
chmod 644 /var/www/apk/ZHANGQIULE-RENAME-NOTE.txt || true
echo "==> Sanity"
grep -n 'brand: "涨球乐"' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '欢迎来到涨球乐' "$ROOT/lib/i18n/messages.ts" | head -3
grep -n 'default: "涨球乐"' "$ROOT/app/layout.tsx" | head -3
! grep -n 'brand: "涨球"' "$ROOT/lib/i18n/messages.ts"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then pnpm build || npx next build --webpack || npm run build
  else npx next build --webpack || npm run build; fi
fi
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
echo DONE
