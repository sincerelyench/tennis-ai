# ZQ-164d · SSR seed ladder / 约球（强杀后仍空）

## Root cause

Prod DB and `/api/friends/ladder` are healthy (~21 Wuxi rows).  
SSR HTML for `/tennis/ladder` paints **`data-ladder-count=0`** /「无锡 暂无球员（0）」until client `refreshLadder` runs.

Yanqing force-kill still empty: WeChat DevTools / web-view often **never calls** `/api/friends/ladder` after the document loads (intros may still fire from AppShell). Client never fills → permanent empty UI that looks like “DB wiped”.

## Fix

1. `lib/friends-ssr-seed.ts` — RSC loopback read of ladder + intros (no DB writes)
2. `ladder/page.tsx` + `friends/page.tsx` — pass `initialLadderRows` / `initialSuccessRecords`
3. `FriendsView` — seed `ladderRows` / `ladderFromApi` / `successRecords` from props so **first HTML already has rows**

## Apply

```bash
bash deploy/ladder-ssr-seed/scripts/apply-on-server.sh /opt/tennis-ai
```

## Verify

Logged-in HTML must show `data-ladder-count` > 0 and `data-ladder-ssr-seed="true"` before any client XHR.
