# ladder-scores-roster (ZQ-110)

## What

1. **Roster**: City ladder shows anyone with a non-empty `displayName`. WeChat is **not** a ladder visibility gate.
   - Unban keeper **小猪** (ban **小朱** instead).
   - Dedupe by `name|cityId` (not global name) so Shanghai phone twins cannot hide Wuxi `u_*` keepers (Ivy / 有名无微信 / 陈燕青).
   - Ladder API scopes to `cityId` **before** dedupe; self inject only replaces same-name twin in the viewed city.
2. **Score UX**: Always show numeric seed/rating; untested (no confirmed matches) → trailing `?` + italic + 「尚未经比赛考验」. Confirmed-match users keep normal score.

## Apply (code only — no DB)

```bash
scp -r deploy/ladder-scores-roster root@HOST:/tmp/
ssh root@HOST 'bash /tmp/ladder-scores-roster/scripts/apply-on-server.sh /opt/tennis-ai'
```

Build completes **before** `systemctl restart`.

## Read-only DB note

Recent named accounts (小猪 / Ivy / 有名无微信 / 袁啸 / Allen Gu / …) still have displayNames in auth blob. Only blank recent name found: `u_zq85tabfix` (test). Do **not** restore blanks without Yanqing OK.
