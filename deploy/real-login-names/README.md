# 真实登录显示名（real-login-names）

Players and coaches show **auth profile display names** only. No demo seeds like 陈晓 / 林凯教练. When nobody has a display name, ranking / matchmaking / network-coach lists are **0 / empty**.

## Surfaces

| Surface | Change |
| --- | --- |
| Web | auth `displayName`, friends directory/ladder APIs, profile editor, friends/match/coach/demo wiring |
| Android / iOS | uni-app injects: empty PLAYERS, directory fetch, purge 林凯 seed |
| mp-weixin | note + coach picker relies on `/api/coaches` filter |

## Apply

```bash
scp -r deploy/real-login-names root@8.216.53.29:/tmp/real-login-names
ssh root@8.216.53.29 'bash /tmp/real-login-names/scripts/apply-on-server.sh /opt/tennis-ai'
```

## APIs

- `GET /tennis/api/auth/session` → `displayName`
- `GET|PATCH /tennis/api/auth/profile` → set display name / city / level
- `GET /tennis/api/friends/directory` → real named users (`count: 0` when empty)
- `GET /tennis/api/friends/ladder` → ladder from directory only
