#!/usr/bin/env bash
# READ-then-repair: one patterned twin misbind for 陈燕青 invites.
# mi-mwebxuf3-7a8cfb: toPhone 13900000003 (shanghai twin) → 18662147197 (wuxi), buddyId already correct.
# Does NOT wipe / cancel / delete intros. Logs JSON backup under BACKUP_DIR.
set -euo pipefail

BACKUP_DIR="${1:-/tmp/yueqiu-missing-invites-rebind}"
mkdir -p "$BACKUP_DIR"

export PGPASSWORD="${PGPASSWORD:-}"
if [[ -z "${PGPASSWORD}" && -f /opt/tennis-ai/.env ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1091
  source /opt/tennis-ai/.env
  set +a
  # DATABASE_URL=postgresql://user:pass@host:port/db
  if [[ -n "${DATABASE_URL:-}" ]]; then
    PGPASSWORD="$(python3 - <<'PY'
import os, urllib.parse
u=urllib.parse.urlparse(os.environ["DATABASE_URL"])
print(urllib.parse.unquote(u.password or ""))
PY
)"
    export PGPASSWORD
  fi
fi

PSQL=(psql -h 127.0.0.1 -U tennis_ai -d tennis_ai -v ON_ERROR_STOP=1)
INTRO_ID="mi-mwebxuf3-7a8cfb"
FROM_PHONE="13900000003"
TO_PHONE="18662147197"

echo "==> Snapshot before"
"${PSQL[@]}" -c "
COPY (
  SELECT id, status, payload
  FROM match_intros
  WHERE id = '${INTRO_ID}'
) TO STDOUT WITH (FORMAT text);
" | tee "$BACKUP_DIR/intro-${INTRO_ID}.before.txt"

"${PSQL[@]}" -t -A -c "
SELECT count(*) FROM match_intros
WHERE id = '${INTRO_ID}'
  AND payload->>'toPhone' = '${FROM_PHONE}'
  AND payload->>'buddyId' = '${TO_PHONE}'
  AND payload->>'toName' = '陈燕青'
  AND status = 'awaiting_accept';
" | tee "$BACKUP_DIR/match-count.txt"

COUNT="$(tr -d '[:space:]' < "$BACKUP_DIR/match-count.txt")"
if [[ "$COUNT" != "1" ]]; then
  echo "SKIP rebind: expected exactly 1 patterned row, got '$COUNT'"
  exit 0
fi

echo "==> Rebind toPhone ${FROM_PHONE} -> ${TO_PHONE}"
"${PSQL[@]}" <<SQL
BEGIN;
UPDATE match_intros
SET
  payload = jsonb_set(payload, '{toPhone}', to_jsonb('${TO_PHONE}'::text), true),
  updated_at = now()
WHERE id = '${INTRO_ID}'
  AND payload->>'toPhone' = '${FROM_PHONE}'
  AND payload->>'buddyId' = '${TO_PHONE}'
  AND status = 'awaiting_accept';

-- Keep blob mirror in sync if present
UPDATE match_intros_blob
SET
  payload = CASE
    WHEN jsonb_typeof(payload->'intros') = 'array' THEN
      jsonb_set(
        payload,
        '{intros}',
        (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN elem->>'id' = '${INTRO_ID}'
                AND elem->>'toPhone' = '${FROM_PHONE}'
              THEN jsonb_set(elem, '{toPhone}', to_jsonb('${TO_PHONE}'::text), true)
              ELSE elem
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(payload->'intros') elem
        ),
        true
      )
    ELSE payload
  END,
  updated_at = now()
WHERE id = 1;
COMMIT;
SQL

"${PSQL[@]}" -c "
SELECT id, status, payload->>'toPhone' AS to_phone, payload->>'buddyId' AS buddy_id, payload->>'toName' AS to_name
FROM match_intros
WHERE id = '${INTRO_ID}';
" | tee "$BACKUP_DIR/intro-${INTRO_ID}.after.txt"

echo "REBIND_OK $INTRO_ID backup=$BACKUP_DIR"
