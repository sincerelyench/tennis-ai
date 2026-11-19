#!/usr/bin/env bash
# ZQ-159: Restore 涨球乐 product intro (4 selling points) on login; drop 动作 copy.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.login-intro-restore-backup-$STAMP"

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

echo "==> Install opt-patch (onboard copy + Onboarding on login)"
cp -a "$PATCH_DIR/opt-patch/." "$ROOT/"

mkdir -p /var/www/apk "$ROOT/public"
if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/login-intro-restore.html
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/login-intro-restore.html"
  chmod 644 /var/www/apk/login-intro-restore.html || true
fi

cat > /var/www/apk/LOGIN-INTRO-RESTORE-NOTE.txt <<EOF
ZQ-159 login-intro-restore
Applied: $STAMP
- Product brand: 涨球乐
- onboard.* restored to 四卖点（约球/多打球），not 动作 version
- Onboarding modal on /tennis/login (LoginView) + app shell
- MP native login hosts the same intro before WeChat one-tap (ZQ-158)

zh:
1. 一起涨球
2. 约到水平相当的球友
3. 赛后看排名变化
4. AI 教练与真实网络教练
EOF
chmod 644 /var/www/apk/LOGIN-INTRO-RESTORE-NOTE.txt || true

echo "==> Sanity"
grep -n '先选技术动作' "$ROOT/lib/i18n/messages.ts" && {
  echo "ERROR: 动作 copy still present" >&2
  exit 1
} || true
grep -n '一起涨球' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '多打球、约对手' "$ROOT/lib/i18n/messages.ts" | head -3
grep -n 'Onboarding' "$ROOT/components/login-view.tsx" | head -5
grep -n 'zq_onboarded' "$ROOT/components/onboarding.tsx" | head -3

cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then pnpm build || npx next build --webpack || npm run build
  else npx next build --webpack || npm run build; fi
fi
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
echo DONE
