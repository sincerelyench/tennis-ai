# Ensure coach login (Coach / 1122)

Demo/test **coach-role** account for https://yqchen.blog/tennis.

| Field | Value |
| --- | --- |
| Username | `Coach` |
| Password | `1122` |
| Role | `coach` |
| Phone key | `13900001390` (existing `DEMO_COACH_PHONE`) |
| Display name | `Coach` |

Does **not** change the four test players (陈燕青、小猪、Ivy、Shirley).

## Apply on production

```bash
# from a worker with SSH to 8.216.53.29
sshpass -e scp -r deploy/ensure-coach-login root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/ensure-coach-login/scripts/apply-on-server.sh /opt/tennis-ai'
```

`apply-on-server.sh` will:

1. Backup auth blob under `/opt/tennis-ai/.ensure-coach-login-backup-<stamp>/`
2. Upsert coach user (prefer `13900001390`) with username/password/role
3. Optional `pg_dump` via `backup-db.sh`
4. `systemctl restart tennis-ai` (clears in-process auth cache)
5. Local curl login verify

## Verify

```bash
curl -sS -H 'content-type: application/json' \
  -d '{"username":"Coach","password":"1122"}' \
  https://yqchen.blog/tennis/api/auth/login
# expect: ok, role "coach", username "coach"
```

Do not put this password in the public repo README.
