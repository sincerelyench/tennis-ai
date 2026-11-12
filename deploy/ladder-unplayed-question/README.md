# ladder-unplayed-question

## What

- Unplayed ladder rows show `?` rating / record and 「还没有比赛」 (no seed number).
- Match intros attach `linkedScore` from the latest **confirmed** score between the pair.
- Phone-first identity when duplicate display names exist (e.g. 陈燕青 / Ivy).
- WeChat is labeled secondary (`{name} · 微信 {wechat}`); username stays primary.

## Apply (code only)

```bash
scp -r deploy/ladder-unplayed-question root@HOST:/tmp/
ssh root@HOST 'bash /tmp/ladder-unplayed-question/scripts/apply-on-server.sh /opt/tennis-ai'
```

Does **not** write Postgres / auth blobs.

## Known data blocker (needs Yanqing OK)

Prod score `ms-1794220127391-3a1aa4` (陈燕青 vs Ivy) is currently `cancelled` by ZQ-105 `rating-growth-fix` (to keep 陈燕青 seed 6.5). Ladder + linkedScore will not show that match until it is restored to `confirmed` — do not restore without explicit OK.
