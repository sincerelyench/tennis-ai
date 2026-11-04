# Server user database (Postgres)

Move 涨球 auth/users, sessions, friends match intros, and pending/confirmed scores off `.data/*.json` onto Postgres on `8.216.53.29` (`yqchen.blog/tennis`).

## What persists in Postgres

| Domain | JSON (legacy) | Postgres |
| --- | --- | --- |
| Users / codes / sessions | `.data/auth.json` | `auth_blob` + mirrored `users` / `sessions` / `codes` |
| Match intros (微信约球引导) | `.data/match-intros.json` | `match_intros_blob` + `match_intros` |
| Match scores (pending → confirm → ladder) | `.data/match-scores.json` | `match_scores_blob` + `match_scores` |

Friends ladder stays computed from directory users + confirmed scores (same API). Four surfaces keep calling the same `/tennis/api/auth/*` and `/tennis/api/friends/*` routes.

## Apply on production

```bash
# from this Mac worker (Keychain / voice-diary-prod password)
export SSHPASS="$(tr -d '\n' < ~/.ssh/voice-diary-prod)"
sshpass -e scp -r deploy/server-user-database root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/server-user-database/scripts/apply-on-server.sh /opt/tennis-ai'
```

`apply-on-server.sh` will:

1. Backup current libs + JSON under `/opt/tennis-ai/.server-user-database-backup-<stamp>/`
2. Create role/db `tennis_ai` (URL written to `/opt/tennis-ai/.env`, systemd `EnvironmentFile`)
3. `npm install pg`
4. Migrate live JSON → Postgres (skipped when tables already have rows)
5. Take a `pg_dump` backup
6. `npm run build` + `systemctl restart tennis-ai`

## Backup path

Primary backups:

```text
/var/backups/tennis-ai/<YYYYMMDD-HHMMSS>/
  tennis_ai.dump          # pg_dump -Fc
  data-json/              # frozen auth.json / match-*.json if present
  SHA256SUMS
```

Manual backup anytime:

```bash
bash /opt/tennis-ai/scripts/backup-db.sh /opt/tennis-ai
```

Optional daily cron (root):

```cron
15 3 * * * /opt/tennis-ai/scripts/backup-db.sh /opt/tennis-ai >> /var/log/tennis-ai-db-backup.log 2>&1
```

Restore example:

```bash
pg_restore --clean --if-exists --dbname="$TENNIS_DATABASE_URL" /var/backups/tennis-ai/<stamp>/tennis_ai.dump
systemctl restart tennis-ai
```

## Verify

```bash
sudo -u tennis node /opt/tennis-ai/scripts/user-db-io.cjs ping
# -> {"ok":true,"users":N,"sessions":N,"scores":N,"intros":N}

curl -sS -H 'content-type: application/json' \
  -d '{"phone":"18662147197"}' \
  http://127.0.0.1:43127/api/auth/code
```
