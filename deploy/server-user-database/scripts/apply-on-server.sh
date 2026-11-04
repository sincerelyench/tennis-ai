#!/usr/bin/env bash
# Apply Postgres-backed user/session/friends stores to /opt/tennis-ai.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.server-user-database-backup-$STAMP"

echo "==> Backup libs -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/scripts"
for f in auth-store.ts match-intros.ts match-scores.ts user-db-sync.ts; do
  cp -a "$ROOT/lib/$f" "$BACKUP/lib/" 2>/dev/null || true
done
cp -a "$ROOT/scripts/user-db-io.cjs" "$BACKUP/scripts/" 2>/dev/null || true
cp -a "$ROOT/package.json" "$BACKUP/" 2>/dev/null || true
if [[ -d "$ROOT/.data" ]]; then
  mkdir -p "$BACKUP/data"
  for f in auth.json match-intros.json match-scores.json; do
    cp -a "$ROOT/.data/$f" "$BACKUP/data/" 2>/dev/null || true
  done
fi

echo "==> Setup Postgres role/db"
bash "$PATCH_DIR/scripts/setup-db.sh" "$ROOT"

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1091
source <(grep -E '^(TENNIS_DATABASE_URL|DATABASE_URL)=' "$ROOT/.env" | sed 's/^/export /')
set +a

echo "==> Install pg dependency"
cd "$ROOT"
if ! node -e "require('pg')" 2>/dev/null; then
  npm install pg@^8.16.0 --save --no-fund --no-audit
fi

echo "==> Install opt-patch + helper"
mkdir -p "$ROOT/lib" "$ROOT/scripts"
cp -a "$PATCH_DIR/opt-patch/lib/." "$ROOT/lib/"
cp -a "$PATCH_DIR/scripts/user-db-io.cjs" "$ROOT/scripts/user-db-io.cjs"
cp -a "$PATCH_DIR/scripts/backup-db.sh" "$ROOT/scripts/backup-db.sh"
chmod +x "$ROOT/scripts/user-db-io.cjs" "$ROOT/scripts/backup-db.sh"
chown -R tennis:tennis "$ROOT/lib" "$ROOT/scripts" "$ROOT/node_modules" "$ROOT/package.json" "$ROOT/package-lock.json" 2>/dev/null || true

echo "==> Migrate live JSON -> Postgres (skip if already populated)"
sudo -u tennis -E env TENNIS_DATABASE_URL="$TENNIS_DATABASE_URL" DATABASE_URL="$TENNIS_DATABASE_URL" \
  node "$ROOT/scripts/user-db-io.cjs" migrate-from-json "$ROOT/.data"

echo "==> Ping DB"
sudo -u tennis -E env TENNIS_DATABASE_URL="$TENNIS_DATABASE_URL" DATABASE_URL="$TENNIS_DATABASE_URL" \
  node "$ROOT/scripts/user-db-io.cjs" ping
echo

echo "==> Initial backup snapshot"
bash "$PATCH_DIR/scripts/backup-db.sh" "$ROOT" | tee /tmp/tennis-ai-db-backup-path.txt

echo "==> Build + restart"
cd "$ROOT"
sudo -u tennis npm run build
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai

echo "==> Smoke APIs"
curl -sS -o /tmp/tennis-code.json -w "code:%{http_code}\n" \
  -H 'content-type: application/json' \
  -d '{"phone":"18662147197"}' \
  http://127.0.0.1:43127/api/auth/code || true
python3 - <<'PY'
import json
print(json.load(open("/tmp/tennis-code.json")))
PY

echo "OK applied. Backup dir recorded in /tmp/tennis-ai-db-backup-path.txt"
echo "JSON lib backup: $BACKUP"
