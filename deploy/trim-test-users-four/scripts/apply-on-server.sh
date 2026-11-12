#!/usr/bin/env bash
# Apply ZQ-90: trim live Postgres test users to 陈燕青 / 小猪 / Ivy / Shirley
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.trim-test-users-four-backup-$STAMP"

echo "==> Backup blobs -> $BACKUP"
mkdir -p "$BACKUP/lib"

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

echo "==> Snapshot current auth/scores/intros"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load auth" \
  >"$BACKUP/auth-before.json"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load scores" \
  >"$BACKUP/scores-before.json"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load intros" \
  >"$BACKUP/intros-before.json"

[[ -f "$ROOT/lib/auth-store.ts" ]] && cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" || true
[[ -f "$ROOT/lib/local-ladder.ts" ]] && cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" || true

echo "==> Patch banned QA names + ensure empty ladderPlayers"
python3 "$PATCH_DIR/scripts/patch-banned-names.py" "$ROOT"

echo "==> Install trim script"
mkdir -p "$ROOT/scripts"
cp -a "$PATCH_DIR/scripts/trim-test-users-four.cjs" "$ROOT/scripts/trim-test-users-four.cjs"
chmod +x "$ROOT/scripts/trim-test-users-four.cjs"

echo "==> Dry-run trim"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/trim-test-users-four.cjs --dry-run" \
  | tee "$BACKUP/trim-dry-run.json"

echo "==> Apply trim"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/trim-test-users-four.cjs" \
  | tee "$BACKUP/trim-result.json"

echo "==> Snapshot after"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs load auth" \
  >"$BACKUP/auth-after.json"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/user-db-io.cjs ping" \
  | tee "$BACKUP/ping-after.json"

if [[ -x "$ROOT/scripts/backup-db.sh" ]]; then
  echo "==> pg_dump via backup-db.sh"
  bash "$ROOT/scripts/backup-db.sh" "$ROOT" || true
elif command -v pg_dump >/dev/null 2>&1; then
  echo "==> pg_dump fallback"
  DUMP_DIR="/var/backups/tennis-ai/$STAMP-trim-four"
  mkdir -p "$DUMP_DIR"
  if [[ -n "${TENNIS_DATABASE_URL:-}" ]]; then
    pg_dump -Fc --dbname="$TENNIS_DATABASE_URL" -f "$DUMP_DIR/tennis_ai.dump" || true
  fi
fi

echo "==> Build Next app (auth-store banned-names patch)"
cd "$ROOT"
build_ok=0
if [[ -f package.json ]]; then
  if sudo -u tennis bash -lc "cd '$ROOT' && npx next build --webpack"; then
    build_ok=1
  elif sudo -u tennis bash -lc "cd '$ROOT' && npm run build"; then
    build_ok=1
  fi
fi
if [[ "$build_ok" -ne 1 ]]; then
  echo "WARN: Next build failed; DB trim still applied; restarting anyway" >&2
fi

echo "==> Restart tennis-ai (clear auth cache)"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true

echo "==> Verify named users via SQL"
sudo -u postgres psql -d tennis_ai -Atc \
  "SELECT display_name FROM users WHERE coalesce(display_name,'') <> '' ORDER BY display_name;" \
  | tee "$BACKUP/named-users-after.txt" || true

echo "==> Ladder sample"
curl -sS "http://127.0.0.1:43127/tennis/api/friends/ladder?cityId=wuxi" \
  | tee "$BACKUP/ladder-wuxi-after.json" \
  | head -c 4000 || true
echo
echo "DONE apply trim-test-users-four"
