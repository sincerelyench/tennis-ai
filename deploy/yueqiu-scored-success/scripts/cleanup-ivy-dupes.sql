-- ZQ-104: remove older 陈燕青↔Ivy successful intros; keep latest + distinct opponents.
-- Keep: mi-mwdqn79j-5b9e75 (latest Ivy), mi-mwdpvnsw-86e9d8 (袁啸), mi-mwdgy25a-968857 (小猪)
-- Drop: mi-mwdqb3tr-bcf6ad, mi-mw94p535-03a1e5

BEGIN;

-- Prefer payload jsonb table used by tennis-ai
DELETE FROM match_intros
WHERE id IN ('mi-mwdqb3tr-bcf6ad', 'mi-mw94p535-03a1e5');

-- Blob mirror if present (ignore if missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'match_intros_blob'
  ) THEN
    -- blob is usually a single JSON document; leave to node cleanup if needed
    NULL;
  END IF;
END $$;

COMMIT;
