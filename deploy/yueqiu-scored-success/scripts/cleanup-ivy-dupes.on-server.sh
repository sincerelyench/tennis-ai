#!/usr/bin/env bash
# Clean duplicate Ivy success intros in live DB (demo). Does NOT restart tennis-ai.
set -euo pipefail

echo "==> Delete older Ivy↔陈燕青 success intros (keep latest mi-mwdqn79j-5b9e75)"
# Use app DB URL if available
if [[ -f /opt/tennis-ai/.env ]]; then
  # shellcheck disable=SC1091
  set -a
  # only export TENNIS_DATABASE_URL if present
  # shellcheck disable=SC2046
  export $(grep -E '^TENNIS_DATABASE_URL=' /opt/tennis-ai/.env | head -1 | xargs -0 echo 2>/dev/null || true)
  set +a
fi

SQL=$(cat <<'EOS'
DELETE FROM match_intros WHERE id IN ('mi-mwdqb3tr-bcf6ad', 'mi-mw94p535-03a1e5');
SELECT id, status, payload->>'fromName' AS from_name, payload->>'toName' AS to_name,
       payload->>'acceptedAt' AS accepted_at
FROM match_intros
WHERE (payload->>'fromName' IN ('陈燕青','Ivy') AND payload->>'toName' IN ('陈燕青','Ivy'))
   OR id IN ('mi-mwdqn79j-5b9e75','mi-mwdpvnsw-86e9d8','mi-mwdgy25a-968857')
ORDER BY payload->>'acceptedAt' DESC NULLS LAST;
EOS
)

if command -v psql >/dev/null 2>&1 && [[ -n "${TENNIS_DATABASE_URL:-}" ]]; then
  psql "$TENNIS_DATABASE_URL" -v ON_ERROR_STOP=1 -c "$SQL"
elif command -v sudo >/dev/null 2>&1; then
  sudo -u postgres psql -d tennis_ai -v ON_ERROR_STOP=1 -c "$SQL"
else
  echo "No psql path; abort"
  exit 1
fi

echo "DONE cleanup-ivy-dupes"
