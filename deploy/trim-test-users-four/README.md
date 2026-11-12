# Trim test users to four (ZQ-90)

Keep only these display names in demo/test/seed users on live Postgres
(`8.216.53.29` / `/opt/tennis-ai`):

- **陈燕青**
- **小朱**
- **Ivy**
- **Shirley**

All other fake/QA display names are cleared. Confirmed scores and match intros
that only involve non-keepers are dropped; keeper aliases are rewritten to the
canonical display names.

## Apply on production

```bash
export SSHPASS="$(tr -d '\n' < ~/.ssh/voice-diary-prod)"
# or: security find-generic-password -s voice-diary-prod-ssh -w
sshpass -e scp -r deploy/trim-test-users-four root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 \
  'bash /tmp/trim-test-users-four/scripts/apply-on-server.sh /opt/tennis-ai'
```

`apply-on-server.sh` will:

1. Backup auth/scores/intros JSON under `/opt/tennis-ai/.trim-test-users-four-backup-<stamp>/`
2. Patch `lib/auth-store.ts` banned-name list via `patch-banned-names.py` (blocks QA labels)
3. Ensure `lib/local-ladder.ts` keeps `ladderPlayers = []`
4. Run `trim-test-users-four.cjs` against Postgres (`TENNIS_DATABASE_URL`)
5. `pg_dump` backup under `/var/backups/tennis-ai/`
6. Rebuild Next + restart `tennis-ai` (clears process auth cache)

## Verify

```bash
sudo -u tennis bash -lc 'cd /opt/tennis-ai && set -a && . ./.env && set +a && node scripts/user-db-io.cjs ping'
# named display names should be exactly the four keepers

curl -sS 'http://127.0.0.1:43127/tennis/api/friends/ladder?cityId=wuxi' | head
```
