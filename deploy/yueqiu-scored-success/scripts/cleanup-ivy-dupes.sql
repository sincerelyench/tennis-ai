-- ZQ-104: BLOCKED without Yanqing prior OK.
-- Prefer UI/API presentation dedupe. Do not DELETE live match_intros rows
-- until Yanqing approves via coordinator.
--
-- Historical candidates (do not run):
--   DELETE older Ivy intros mi-mwdqb3tr-bcf6ad, mi-mw94p535-03a1e5
--   KEEP mi-mwdqn79j-5b9e75 (Ivy), mi-mwdpvnsw-86e9d8 (袁啸), mi-mwdgy25a-968857 (小猪)

SELECT 'refused: needs Yanqing OK' AS status;
