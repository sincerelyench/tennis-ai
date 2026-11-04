# 涨球用户库备份路径

- Host: `8.216.53.29` / `yqchen.blog`
- App: `/opt/tennis-ai`
- Database: Postgres `tennis_ai` (local `127.0.0.1:5432`)
- Connection: `/opt/tennis-ai/.env` → `TENNIS_DATABASE_URL` (systemd `EnvironmentFile`)

## Canonical backup directory

```text
/var/backups/tennis-ai/<YYYYMMDD-HHMMSS>/
```

Each stamp contains:

- `tennis_ai.dump` — `pg_dump --format=custom`
- `data-json/` — optional freeze of legacy `.data/auth.json`, `match-intros.json`, `match-scores.json`
- `SHA256SUMS`

Retention: apply/backup script keeps the newest 14 stamp directories.

## Commands

```bash
# on server
bash /opt/tennis-ai/scripts/backup-db.sh /opt/tennis-ai
sudo -u tennis node /opt/tennis-ai/scripts/user-db-io.cjs ping
```
