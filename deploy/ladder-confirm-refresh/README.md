# ZQ-131 ladder-confirm-refresh

## Problem

After 录入比分 succeeds and the opponent confirms:

1. Local ladder / UTR often looks unchanged.
2. 「比赛结果」under 本地排行 may stay stale until city/format remount.

## Root causes

1. **Twin phone binding** — `resolveUserIdByName("陈燕青")` can pick shanghai demo `13900000003` instead of wuxi `18662147197`. City ladder then drops the match (`every participant in city`), so rank/UTR/last-opponent do not move for the real account.
2. **Client gap** — `onScoreAction(confirm)` refreshed scores + ladder but **not** `refreshCityMatches()`; submitter had **no polling** while waiting.
3. **Expected Δ=0** — win vs much weaker (`EXCLUDE_GAP=1.0`) intentionally leaves rating unchanged (e.g. 陈燕青 vs Ivy).

## Fix (code only)

| File | Change |
| --- | --- |
| `lib/match-scores.ts` | Bind submitter/confirm session phones; city + non-demo preference for name resolve |
| `components/friends-view.tsx` | Refetch city results on confirm; poll while pending |

## Apply on production

```bash
export SSHPASS=...
sshpass -e scp -r deploy/ladder-confirm-refresh root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/ladder-confirm-refresh/scripts/apply-on-server.sh /opt/tennis-ai'
```

Does **not** rewrite match scores. Existing wrong `playerAId` on `ms-1794543127774-c883c0` needs Yanqing OK to set `18662147197`.

## Real-time answer

**Intended:** yes — confirm unlocks ranking; APIs recompute on each GET.  
**Actually (before fix):** confirming client partially refreshed; submitter / city list often stale; twin-id matches never entered the city ladder replay.
