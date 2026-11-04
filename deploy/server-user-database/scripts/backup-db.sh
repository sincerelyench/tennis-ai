#!/usr/bin/env bash
# Backup 涨球 Postgres user DB (+ optional JSON freeze).
set -euo pipefail

ROOT="${1:-/opt/tennis-ai}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${TENNIS_DB_BACKUP_DIR:-/var/backups/tennis-ai}"
OUT_DIR="$BACKUP_ROOT/$STAMP"
ENV_FILE="$ROOT/.env"

mkdir -p "$OUT_DIR"
chmod 700 "$BACKUP_ROOT" "$OUT_DIR"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(TENNIS_DATABASE_URL|DATABASE_URL)=' "$ENV_FILE" | sed 's/^/export /')
  set +a
fi

URL="${TENNIS_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "Missing TENNIS_DATABASE_URL" >&2
  exit 1
fi

DUMP="$OUT_DIR/tennis_ai.dump"
echo "==> pg_dump -> $DUMP"
pg_dump --dbname="$URL" --format=custom --file="$DUMP"

if [[ -d "$ROOT/.data" ]]; then
  echo "==> freeze .data JSON snapshots"
  mkdir -p "$OUT_DIR/data-json"
  for f in auth.json match-intros.json match-scores.json; do
    [[ -f "$ROOT/.data/$f" ]] && cp -a "$ROOT/.data/$f" "$OUT_DIR/data-json/"
  done
fi

sha256sum "$DUMP" > "$OUT_DIR/SHA256SUMS"
[[ -d "$OUT_DIR/data-json" ]] && find "$OUT_DIR/data-json" -type f -print0 | xargs -0 sha256sum >> "$OUT_DIR/SHA256SUMS"

# keep last 14 stamped dirs
ls -1dt "$BACKUP_ROOT"/20* 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "OK backup at $OUT_DIR"
echo "$OUT_DIR"
