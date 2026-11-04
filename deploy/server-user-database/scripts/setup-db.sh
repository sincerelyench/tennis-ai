#!/usr/bin/env bash
# Create Postgres role/db for 涨球 user store on the production host.
set -euo pipefail

DB_NAME="${TENNIS_DB_NAME:-tennis_ai}"
DB_USER="${TENNIS_DB_USER:-tennis_ai}"
ROOT="${1:-/opt/tennis-ai}"
ENV_FILE="$ROOT/.env"
DROP_IN_DIR="/etc/systemd/system/tennis-ai.service.d"
DROP_IN="$DROP_IN_DIR/database.conf"

mkdir -p "$ROOT"
touch "$ENV_FILE"
chown tennis:tennis "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE"

if grep -q '^TENNIS_DATABASE_URL=' "$ENV_FILE"; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(TENNIS_DATABASE_URL|DATABASE_URL)=' "$ENV_FILE" | sed 's/^/export /')
  set +a
  echo "Reusing TENNIS_DATABASE_URL from $ENV_FILE"
else
  DB_PASS="$(openssl rand -hex 16)"
  TENNIS_DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
  grep -vE '^(TENNIS_DATABASE_URL|DATABASE_URL)=' "$ENV_FILE" > "${ENV_FILE}.tmp" || true
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  {
    echo "TENNIS_DATABASE_URL=${TENNIS_DATABASE_URL}"
    echo "DATABASE_URL=${TENNIS_DATABASE_URL}"
  } >> "$ENV_FILE"
  chown tennis:tennis "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  export TENNIS_DATABASE_URL DATABASE_URL="$TENNIS_DATABASE_URL"
  echo "Wrote TENNIS_DATABASE_URL to $ENV_FILE"
fi

DB_PASS="$(python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["TENNIS_DATABASE_URL"])
print(urllib.parse.unquote(u.password or ""))
PY
)"
DB_USER="$(python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["TENNIS_DATABASE_URL"])
print(urllib.parse.unquote(u.username or "tennis_ai"))
PY
)"
DB_NAME="$(python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["TENNIS_DATABASE_URL"])
print((u.path or "/tennis_ai").lstrip("/") or "tennis_ai")
PY
)"

echo "==> Ensure role/db ${DB_USER}/${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
SQL

mkdir -p "$DROP_IN_DIR"
cat > "$DROP_IN" <<EOF
[Service]
EnvironmentFile=-${ENV_FILE}
EOF

systemctl daemon-reload
echo "OK database ready"
