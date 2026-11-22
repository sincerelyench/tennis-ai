#!/usr/bin/env bash
# ZQ-167: role (学员/教练) at signup only; login has no role picker.
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.signup-role-picker-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib/i18n" "$BACKUP/app/api/auth/register"
cp -a "$ROOT/components/login-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/register/route.ts" "$BACKUP/app/api/auth/register/" 2>/dev/null || true

echo "==> Copy patched sources"
cp -a "$PATCH_DIR/opt-patch/components/login-view.tsx" "$ROOT/components/login-view.tsx"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/register/route.ts" "$ROOT/app/api/auth/register/route.ts"

echo "==> i18n signup role labels"
ROOT="$ROOT" python3 - <<'PY'
from pathlib import Path
import os
p = Path(os.environ["ROOT"]) / "lib/i18n/messages.ts"
t = p.read_text()
if "signupRoleLabel" in t and "ZQ-167" in t:
    print("i18n already has signupRoleLabel; skip")
else:
    en_needle = '      signupHint: "After register you’ll set your display name and city.",'
    en_ins = (
        '      signupHint: "After register you’ll set your display name and city.",\n'
        '      // ZQ-167\n'
        '      signupRoleLabel: "I am a",\n'
        '      signupRoleHint: "Choose player or coach when creating the account. Sign-in does not ask again.",'
    )
    zh_needle = '      signupHint: "注册成功后需填写显示名和所在城市。",'
    zh_ins = (
        '      signupHint: "注册成功后需填写显示名和所在城市。",\n'
        '      // ZQ-167\n'
        '      signupRoleLabel: "我是",\n'
        '      signupRoleHint: "注册时选择学员或教练；登录时不用再选。",'
    )
    if en_needle not in t:
        raise SystemExit(f"missing EN needle: {en_needle}")
    if zh_needle not in t:
        raise SystemExit(f"missing ZH needle: {zh_needle}")
    t = t.replace(en_needle, en_ins, 1).replace(zh_needle, zh_ins, 1)
    p.write_text(t)
    print("i18n signupRole* added")
PY

echo "==> Sanity"
grep -n "ZQ-167\|data-signup-role\|data-signin-no-role\|signupRoleLabel" \
  "$ROOT/components/login-view.tsx" | head -20
grep -n "ZQ-167\|roleRaw" "$ROOT/lib/auth-store.ts" | head -10
grep -n "ZQ-167\|body?.role" "$ROOT/app/api/auth/register/route.ts" | head -10
grep -n "signupRoleLabel" "$ROOT/lib/i18n/messages.ts" | head -5
# login tab must not keep data-role-switch in signin-only block
if grep -n 'authTab === "signin"' -A40 "$ROOT/components/login-view.tsx" | grep -q 'data-role-switch'; then
  echo "ERROR: role switch still under signin" >&2
  exit 1
fi
grep -q 'data-signup-role="true"' "$ROOT/components/login-view.tsx"

echo "==> Rebuild"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npm run build
  systemctl start tennis-ai
fi
echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE ZQ-167 signup-role-picker backup=$BACKUP"
