#!/usr/bin/env bash
# Ensure live demo coach login: Coach / 1122 (role=coach).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ensure-coach-login-backup-$STAMP"

echo "==> Backup auth -> $BACKUP"
mkdir -p "$BACKUP"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

run_as_tennis() {
  if [[ "$(id -un)" == "tennis" ]]; then
    bash -lc "$*"
  else
    sudo -u tennis bash -lc "$*"
  fi
}

run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load auth" \
  >"$BACKUP/auth-before.json"

echo "==> Install ensure script"
mkdir -p "$ROOT/scripts"
cp -a "$PATCH_DIR/scripts/ensure-coach-login.cjs" "$ROOT/scripts/ensure-coach-login.cjs"
chmod +x "$ROOT/scripts/ensure-coach-login.cjs"

echo "==> Dry-run"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/ensure-coach-login.cjs --dry-run" \
  | tee "$BACKUP/ensure-dry-run.json"

echo "==> Apply"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/ensure-coach-login.cjs" \
  | tee "$BACKUP/ensure-result.json"

run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load auth" \
  >"$BACKUP/auth-after.json"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs ping" \
  | tee "$BACKUP/ping-after.json"

if [[ -x "$ROOT/scripts/backup-db.sh" ]]; then
  echo "==> pg_dump via backup-db.sh"
  bash "$ROOT/scripts/backup-db.sh" "$ROOT" || true
fi

echo "==> Restart tennis-ai (clear auth cache)"
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai | tee "$BACKUP/service-status.txt"

echo "==> Verify password login locally"
curl -sS -H 'content-type: application/json' \
  -d '{"username":"Coach","password":"1122"}' \
  http://127.0.0.1:43127/tennis/api/auth/login \
  | tee "$BACKUP/login-verify.json"
echo
# Require coach role in JSON (fail apply if login broken)
python3 - "$BACKUP/login-verify.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
if not data.get("ok") or data.get("role") != "coach":
    raise SystemExit(f"login verify failed: {data}")
print("login verify ok:", {k: data.get(k) for k in ("role", "username", "displayName", "phone")})
PY

echo "Done. Backup: $BACKUP"
