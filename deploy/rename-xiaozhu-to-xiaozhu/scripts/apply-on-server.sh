#!/usr/bin/env bash
# Apply ZQ-92: rename live display 小朱 → 小猪; keep four keepers.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.rename-xiaozhu-to-xiaozhu-backup-$STAMP"

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

echo "==> Patch banned names (allow 小猪, ban 小朱) + empty ladderPlayers"
python3 "$PATCH_DIR/scripts/patch-banned-names.py" "$ROOT"

echo "==> Install rename script"
mkdir -p "$ROOT/scripts"
cp -a "$PATCH_DIR/scripts/rename-xiaozhu-to-xiaozhu.cjs" "$ROOT/scripts/rename-xiaozhu-to-xiaozhu.cjs"
chmod +x "$ROOT/scripts/rename-xiaozhu-to-xiaozhu.cjs"

echo "==> Dry-run rename"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/rename-xiaozhu-to-xiaozhu.cjs --dry-run" \
  | tee "$BACKUP/rename-dry-run.json" \
  || { echo "WARN: dry-run reported not-ok; continuing to apply for clearer error" >&2; }

echo "==> Apply rename"
run_as_tennis "cd '$ROOT' && set -a && . ./.env && set +a && node scripts/rename-xiaozhu-to-xiaozhu.cjs" \
  | tee "$BACKUP/rename-result.json"

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
  DUMP_DIR="/var/backups/tennis-ai/$STAMP-rename-xiaozhu"
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
  elif sudo -u tennis bash -lc "cd '$ROOT' && pnpm build"; then
    build_ok=1
  fi
fi
if [[ "$build_ok" -ne 1 ]]; then
  echo "WARN: Next build failed; DB rename still applied; restarting anyway" >&2
fi

echo "==> Restart tennis-ai (clear auth cache)"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true

echo "==> Verify named users via SQL"
sudo -u postgres psql -d tennis_ai -Atc \
  "SELECT display_name FROM users WHERE coalesce(display_name,'') <> '' ORDER BY display_name;" \
  | tee "$BACKUP/named-users-after.txt" || true

sudo -u postgres psql -d tennis_ai -Atc \
  "SELECT phone || E'\t' || display_name FROM users WHERE coalesce(display_name,'') <> '' ORDER BY display_name;" \
  | tee "$BACKUP/named-after.txt" || true

echo "==> Ladder sample"
curl -sS "http://127.0.0.1:43127/tennis/api/friends/ladder?cityId=wuxi" \
  | tee "$BACKUP/ladder-wuxi-after.json" \
  | head -c 4000 || true
echo
echo "DONE apply rename-xiaozhu-to-xiaozhu"
