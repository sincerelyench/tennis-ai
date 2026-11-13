# ZQ-121 — 本地排行下比赛结果列表

Under **本地排行**, below the ladder board: list all **confirmed** match results for the current city. Tap a row to open 比赛集锦 (description / video URL) and comments (ZQ-115 APIs).

## Kit

- `opt-patch/lib/match-scores.ts` — `listConfirmedScoresForCity`
- `opt-patch/app/api/friends/scores/route.ts` — `GET ?scope=city&cityId=&format=`
- `opt-patch/components/friends-view.tsx` — list + detail dialog under ladder
- `opt-patch/lib/i18n/messages.ts` — zh/en copy keys
- `scripts/apply-on-server.sh` — backup → copy → build → restart

## City filter

Same city context as the ladder: a confirmed score is included when either player has a directory profile in that city (by id or display name).

## Deploy

```bash
bash deploy/ladder-match-results-list/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only. No Postgres / blob writes.
