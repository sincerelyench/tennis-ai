#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.onboard-login-only-backup-$STAMP"
mkdir -p "$BACKUP/components"
cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/logout-button.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$PATCH_DIR/opt-patch/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"
cp -a "$PATCH_DIR/opt-patch/components/logout-button.tsx" "$ROOT/components/logout-button.tsx"
grep -n "ZQ-165\|onboarding only on login" "$ROOT/components/app-shell.tsx"
grep -n "ZQ-165\|location.assign" "$ROOT/components/logout-button.tsx"
# ensure Onboarding not rendered in app-shell
if grep -q '<Onboarding' "$ROOT/components/app-shell.tsx"; then
  echo "ERROR: Onboarding still in app-shell" >&2
  exit 1
fi
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  systemctl start tennis-ai
fi
echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE ZQ-165 onboard-login-only"
