# Trim demo seed users only (ZQ-90 / ZQ-107)

Keepers (always preserved):

- **陈燕青** (`18662147197`)
- **小猪** (`u_pig`)
- **Ivy** (`u_ivy`)
- **Shirley** (`u_shirley`)
- **Coach** (`13900001390`)

**Hard rule:** only phones on the `DEMO_SEED_PHONES` allowlist may have
display names cleared. Real registered users (e.g. 袁啸 / `u__ddd123`) are
never wiped. Scores/intros are dropped only when *both* parties are demo seeds.

## Apply on production

```bash
export SSHPASS="$(tr -d '\n' < ~/.ssh/voice-diary-prod)"
# or: security find-generic-password -s voice-diary-prod-ssh -w
sshpass -e scp -r deploy/trim-test-users-four root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 \
  'bash /tmp/trim-test-users-four/scripts/apply-on-server.sh /opt/tennis-ai'
```

`apply-on-server.sh` will:

1. Backup auth/scores/intros under `/opt/tennis-ai/.trim-test-users-four-backup-<stamp>/`
2. Patch banned-name list (QA labels only)
3. Run `trim-test-users-four.cjs --dry-run` then `--apply-demo-seeds-only`
4. `pg_dump` under `/var/backups/tennis-ai/`
5. Rebuild Next + restart `tennis-ai`

## Manual dry-run

```bash
cd /opt/tennis-ai && set -a && . ./.env && set +a
node /path/to/trim-test-users-four.cjs --dry-run
# writes only with:
node /path/to/trim-test-users-four.cjs --apply-demo-seeds-only
```

Running with no flags exits 2 (refuses).
