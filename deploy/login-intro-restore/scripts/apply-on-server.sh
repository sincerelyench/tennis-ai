#!/usr/bin/env bash
# ZQ-159: Mirror prod onboard copy (四卖点 + 涨球乐) into /opt/tennis-ai.
# IMPORTANT: Mac bc-b415e8ef already applied this to prod (2026-11-20).
# Do NOT re-run casually — it would rebuild/restart and can fight the hotpatch.
# Use only if live i18n drifted from this kit (verify first).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.login-intro-restore-backup-$STAMP"

if [[ "${FORCE_ZQ159_APPLY:-}" != "1" ]]; then
  echo "REFUSING apply: prod was hotpatched by Mac bc-b415e8ef."
  echo "This kit mirrors live onboard.* — merge the GitHub PR for repo parity."
  echo "To force (drift repair only): FORCE_ZQ159_APPLY=1 $0 $ROOT"
  exit 2
fi

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
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/onboarding-4-points.html
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/onboarding-4-points.html"
  chmod 644 /var/www/apk/onboarding-4-points.html || true
fi

cat > /var/www/apk/LOGIN-INTRO-RESTORE-NOTE.txt <<EOF
ZQ-159 login-intro-restore (repo mirror of Mac hotpatch)
Forced apply: $STAMP
- Product brand: 涨球乐
- onboard.* = webpage 四卖点（not 动作）
- Original Mac apply: bc-b415e8ef / .zq159-onboard-4points-zhangqiule-backup-*
EOF
chmod 644 /var/www/apk/LOGIN-INTRO-RESTORE-NOTE.txt || true

echo "==> Sanity"
grep -n '先选技术动作' "$ROOT/lib/i18n/messages.ts" && {
  echo "ERROR: 动作 copy still present" >&2
  exit 1
} || true
grep -n '一起涨球' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '多打球、约对手' "$ROOT/lib/i18n/messages.ts" | head -3

cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then pnpm build || npx next build --webpack || npm run build
  else npx next build --webpack || npm run build; fi
fi
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
echo DONE
